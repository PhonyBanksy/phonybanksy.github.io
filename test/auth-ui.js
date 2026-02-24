/**
 * auth-ui.js
 * Handles Google Sign-In, logout, and the first-time profile setup modal
 * (where the user sets their in-game name and Discord username).
 *
 * Exposes: window.AuthUI = { init, getCurrentUser, isAdmin }
 */

import { auth, db, provider }                              from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Sanitize helper (strips HTML, limits length) ─────────────────────────────
function sanitize(str, maxLen = 64) {
  return String(str)
    .replace(/[<>"'&]/g, '')   // strip injection chars
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

    if (!btnLogin) return;   // auth UI not present on this page

    btnLogin.addEventListener('click',  () => loginWithGoogle());
    btnLogout.addEventListener('click', () => logout());
    btnSaveProfile.addEventListener('click', () => saveProfile());

    // Allow closing modal by clicking backdrop
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal && _currentUserDoc?.inGameName) {
        profileModal.style.display = 'none';
      }
    });

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

// ── Google Sign-In ────────────────────────────────────────────────────────────
async function loginWithGoogle() {
  try {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Signing in…';
    await signInWithPopup(auth, provider);
    // onAuthStateChanged handles the rest
  } catch (err) {
    console.error('Login failed:', err);
    btnLogin.disabled = false;
    btnLogin.textContent = '🔑 Sign in with Google';
    if (err.code !== 'auth/popup-closed-by-user') {
      alert('Sign-in failed: ' + err.message);
    }
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout() {
  await signOut(auth);
}

// ── User document management ──────────────────────────────────────────────────
async function loadOrCreateUserDoc(user) {
  const ref     = doc(db, 'users', user.uid);
  const snap    = await getDoc(ref);

  if (snap.exists()) {
    _currentUserDoc = snap.data();
    // Show profile modal if they haven't set names yet
    if (!_currentUserDoc.inGameName || !_currentUserDoc.discordName) {
      showProfileModal();
    }
  } else {
    // First login: create document with default role
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
  inpIngameName.value  = _currentUserDoc.inGameName  || '';
  inpDiscordName.value = _currentUserDoc.discordName || '';
  profileError.textContent = '';
  profileModal.style.display = 'flex';
  inpIngameName.focus();
}

async function saveProfile() {
  const ingame  = sanitize(inpIngameName.value,  64);
  const discord = sanitize(inpDiscordName.value, 64);

  if (!ingame) {
    profileError.textContent = 'In-game name is required.';
    return;
  }
  if (!discord) {
    profileError.textContent = 'Discord username is required.';
    return;
  }

  btnSaveProfile.disabled = true;
  btnSaveProfile.textContent = 'Saving…';

  try {
    const ref = doc(db, 'users', _currentUser.uid);
    await setDoc(ref, { inGameName: ingame, discordName: discord }, { merge: true });
    _currentUserDoc = { ..._currentUserDoc, inGameName: ingame, discordName: discord };
    profileModal.style.display = 'none';
    showToast(`Welcome, ${ingame}!`);
    document.dispatchEvent(new CustomEvent('profileUpdated', { detail: _currentUserDoc }));
  } catch (err) {
    profileError.textContent = 'Save failed: ' + err.message;
  } finally {
    btnSaveProfile.disabled = false;
    btnSaveProfile.textContent = 'Save Profile';
  }
}

// ── Topbar UI state ───────────────────────────────────────────────────────────
function updateTopbarUI(loggedIn) {
  if (!btnLogin) return;
  if (loggedIn) {
    btnLogin.style.display   = 'none';
    btnLogout.style.display  = 'inline-flex';
    userDisplay.style.display = 'inline-flex';
    const name = _currentUserDoc?.inGameName || _currentUser?.displayName || 'User';
    userDisplay.textContent = '👤 ' + name;
    if (AuthUI.isAdmin()) userDisplay.textContent += ' ⭐';
  } else {
    btnLogin.style.display    = 'inline-flex';
    btnLogout.style.display   = 'none';
    userDisplay.style.display = 'none';
    btnLogin.disabled         = false;
    btnLogin.textContent      = '🔑 Sign in with Google';
  }
}

// ── Toast helper (re-use existing toast if available) ─────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}
