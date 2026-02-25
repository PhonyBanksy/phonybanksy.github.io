/**
 * auth-ui.js
 * Handles Google Sign-In (redirect flow), logout, and the first-time profile setup modal.
 * Uses signInWithRedirect to avoid popup-blocked issues on most browsers/hosts.
 *
 * Exposes: window.AuthUI = { init, getCurrentUser, isAdmin }
 */

import { auth, db, provider }                                                 from './firebase-config.js';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }                               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Sanitize helper ───────────────────────────────────────────────────────────
function sanitize(str, maxLen = 64) {
  return String(str)
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ── DOM refs (injected by init()) ─────────────────────────────────────────────
let btnLogin, btnLogout, userDisplay, profileModal,
    inpIngameName, inpDiscordName, btnSaveProfile, profileError;

let _currentUser     = null;
let _currentUserDoc  = null;

// ── Public API ────────────────────────────────────────────────────────────────
window.AuthUI = {
  getCurrentUser:    () => _currentUser,
  getCurrentUserDoc: () => _currentUserDoc,
  isAdmin:           () => _currentUserDoc?.role === 'admin',

  init() {
    btnLogin       = document.getElementById('btnLogin');
    btnLogout      = document.getElementById('btnLogout');
    userDisplay    = document.getElementById('userDisplay');
    profileModal   = document.getElementById('profileModal');
    inpIngameName  = document.getElementById('inpIngameName');
    inpDiscordName = document.getElementById('inpDiscordName');
    btnSaveProfile = document.getElementById('btnSaveProfile');
    profileError   = document.getElementById('profileError');

    if (!btnLogin) return;

    btnLogin.addEventListener('click',  () => loginWithGoogle());
    btnLogout.addEventListener('click', () => logout());
    if (btnSaveProfile) btnSaveProfile.addEventListener('click', () => saveProfile());

    // Allow closing modal by clicking backdrop (only if profile already set)
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal && _currentUserDoc?.inGameName) {
          profileModal.style.display = 'none';
        }
      });
    }

    // Handle result from a previous signInWithRedirect call
    handleRedirectResult();

    // React to auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        _currentUser = user;
        await loadOrCreateUserDoc(user);
        updateTopbarUI(true);
        document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user, userDoc: _currentUserDoc } }));
      } else {
        _currentUser    = null;
        _currentUserDoc = null;
        updateTopbarUI(false);
        document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null } }));
      }
    });
  }
};

// ── Google Sign-In (redirect — avoids popup-blocked) ─────────────────────────
async function loginWithGoogle() {
  try {
    btnLogin.disabled    = true;
    btnLogin.textContent = 'Redirecting…';
    await signInWithRedirect(auth, provider);
    // Browser will navigate away; onAuthStateChanged fires on return
  } catch (err) {
    console.error('Login redirect failed:', err);
    btnLogin.disabled    = false;
    btnLogin.textContent = '🔑 Sign in with Google';
    alert('Sign-in failed: ' + err.message);
  }
}

// ── Handle redirect result on page load ───────────────────────────────────────
async function handleRedirectResult() {
  try {
    await getRedirectResult(auth);
    // If we came back from Google redirect, onAuthStateChanged fires automatically
  } catch (err) {
    // Ignore cancelled-popup errors; log anything else
    if (err.code !== 'auth/cancelled-popup-request') {
      console.warn('Redirect result:', err.code, err.message);
    }
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout() {
  await signOut(auth);
}

// ── User document management ──────────────────────────────────────────────────
async function loadOrCreateUserDoc(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    _currentUserDoc = snap.data();
    if (!_currentUserDoc.inGameName || !_currentUserDoc.discordName) {
      showProfileModal();
    }
  } else {
    const newDoc = {
      googleDisplayName: sanitize(user.displayName || '', 128),
      email:             user.email || '',
      inGameName:        '',
      discordName:       '',
      role:              'user',
      createdAt:         serverTimestamp()
    };
    await setDoc(ref, newDoc);
    _currentUserDoc = newDoc;
    showProfileModal();
  }
}

// ── Profile modal ─────────────────────────────────────────────────────────────
function showProfileModal() {
  if (!profileModal) return;
  if (inpIngameName)  inpIngameName.value  = _currentUserDoc.inGameName  || '';
  if (inpDiscordName) inpDiscordName.value = _currentUserDoc.discordName || '';
  if (profileError)   profileError.textContent = '';
  profileModal.style.display = 'flex';
  if (inpIngameName) inpIngameName.focus();
}

async function saveProfile() {
  const ingame  = sanitize(inpIngameName?.value  || '', 64);
  const discord = sanitize(inpDiscordName?.value || '', 64);

  if (!ingame)  { if (profileError) profileError.textContent = 'In-game name is required.';  return; }
  if (!discord) { if (profileError) profileError.textContent = 'Discord username is required.'; return; }

  btnSaveProfile.disabled    = true;
  btnSaveProfile.textContent = 'Saving…';

  try {
    const ref = doc(db, 'users', _currentUser.uid);
    await setDoc(ref, { inGameName: ingame, discordName: discord }, { merge: true });
    _currentUserDoc = { ..._currentUserDoc, inGameName: ingame, discordName: discord };
    profileModal.style.display = 'none';
    showToast(`Welcome, ${ingame}!`);
    document.dispatchEvent(new CustomEvent('profileUpdated', { detail: _currentUserDoc }));
  } catch (err) {
    if (profileError) profileError.textContent = 'Save failed: ' + err.message;
  } finally {
    btnSaveProfile.disabled    = false;
    btnSaveProfile.textContent = 'Save Profile';
  }
}

// ── Topbar UI state ───────────────────────────────────────────────────────────
function updateTopbarUI(loggedIn) {
  if (!btnLogin) return;
  if (loggedIn) {
    btnLogin.style.display    = 'none';
    btnLogout.style.display   = 'inline-flex';
    userDisplay.style.display = 'inline-flex';
    const name = _currentUserDoc?.inGameName || _currentUser?.displayName || 'User';
    userDisplay.textContent = '👤 ' + name + (window.AuthUI.isAdmin() ? ' ⭐' : '');
  } else {
    btnLogin.style.display    = 'inline-flex';
    btnLogout.style.display   = 'none';
    userDisplay.style.display = 'none';
    btnLogin.disabled         = false;
    btnLogin.textContent      = '🔑 Sign in with Google';
  }
}

// ── Toast helper ──────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}
