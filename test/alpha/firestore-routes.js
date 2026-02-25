/**
 * firestore-routes.js
 * All Firestore read/write for routes, ratings, favorites, downloads, admin.
 */

import { db } from './firebase-config.js';
import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ROUTES_COL  = 'routes';
const MAX_NAME    = 128;
const MAX_WP      = 500;
const MIN_SAVE_MS = 5000;
const VALID_CATS  = ['Sprint','Circuit','Endurance','Offroad','Dakar','Hills','Technical','Speed'];

let _lastSaveTime = 0;

function validateRouteData(routeData) {
  if (!routeData || typeof routeData !== 'object')
    return { ok: false, error: 'Route data must be an object.' };
  if (!Array.isArray(routeData.waypoints))
    return { ok: false, error: 'Route must have a waypoints array.' };
  if (routeData.waypoints.length === 0)
    return { ok: false, error: 'Route must have at least one waypoint.' };
  if (routeData.waypoints.length > MAX_WP)
    return { ok: false, error: `Too many waypoints (max ${MAX_WP}).` };
  const cleanWaypoints = routeData.waypoints.map((wp, i) => {
    if (!wp || typeof wp !== 'object') throw new Error(`Waypoint ${i} is not an object.`);
    const rot = wp.rotation, tr = wp.translation, sc = wp.scale3D;
    if (!rot || typeof rot !== 'object') throw new Error(`Waypoint ${i} missing rotation.`);
    if (!tr  || typeof tr  !== 'object') throw new Error(`Waypoint ${i} missing translation.`);
    return {
      rotation:    { x: Number(rot.x)||0, y: Number(rot.y)||0, z: Number(rot.z)||0, w: Number(rot.w)??1 },
      translation: { x: Number(tr.x)||0,  y: Number(tr.y)||0,  z: Number(tr.z)||0 },
      scale3D: sc ? { x: Number(sc.x)||1, y: Number(sc.y)||10, z: Number(sc.z)||1 }
                  : { x: 1, y: 10, z: 1 }
    };
  });
  return { ok: true, data: {
    routeName: String(routeData.routeName || 'Unnamed').slice(0, MAX_NAME),
    waypoints: cleanWaypoints
  }};
}

function sanitizeName(str) {
  return String(str || '').replace(/[<>"'&]/g, '').trim().slice(0, MAX_NAME) || 'Unnamed';
}

function cleanCats(categories) {
  return Array.isArray(categories)
    ? categories.filter(c => VALID_CATS.includes(c)).slice(0, 8)
    : [];
}

window.FirestoreRoutes = {

  /* ── SAVE ── */
  async saveRoute({ routeName, routeData, isPublic = true, uid, inGameName, routeId = null, categories = [] }) {
    if (!uid) throw new Error('Must be logged in to save routes.');
    const now = Date.now();
    if (now - _lastSaveTime < MIN_SAVE_MS) throw new Error('Saving too fast — please wait a moment.');
    const validation = validateRouteData(routeData);
    if (!validation.ok) throw new Error(validation.error);
    const payload = {
      ownerUid:      uid,
      characterId:   uid,
      inGameName:    sanitizeName(inGameName),
      routeName:     sanitizeName(routeName),
      routeData:     validation.data,
      isPublic:      Boolean(isPublic),
      waypointCount: validation.data.waypoints.length,
      categories:    cleanCats(categories),
      updatedAt:     serverTimestamp()
    };
    let savedId;
    if (routeId) {
      const existing = await getDoc(doc(db, ROUTES_COL, routeId));
      if (!existing.exists()) throw new Error('Route not found.');
      if (existing.data().ownerUid !== uid && !window.AuthUI?.isAdmin())
        throw new Error('Permission denied.');
      await setDoc(doc(db, ROUTES_COL, routeId), payload, { merge: true });
      savedId = routeId;
    } else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, ROUTES_COL), payload);
      savedId = ref.id;
    }
    _lastSaveTime = Date.now();
    return savedId;
  },

  /* ── ADMIN UPDATE (name / tags / visibility on any route) ── */
  async adminUpdateRoute(routeId, fields) {
    if (!window.AuthUI?.isAdmin()) throw new Error('Admin only.');
    const updates = { updatedAt: serverTimestamp() };
    if (fields.routeName  !== undefined) updates.routeName  = sanitizeName(fields.routeName);
    if (fields.inGameName !== undefined) updates.inGameName = sanitizeName(fields.inGameName);
    if (fields.isPublic   !== undefined) updates.isPublic   = Boolean(fields.isPublic);
    if (fields.categories !== undefined) updates.categories = cleanCats(fields.categories);
    // Admin update uses setDoc+merge so it bypasses the content-update ownership check
    // (handled by admin-only Firestore rule)
    await setDoc(doc(db, ROUTES_COL, routeId), updates, { merge: true });
  },

  /* ── DELETE ── */
  async deleteRoute(routeId, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const snap = await getDoc(doc(db, ROUTES_COL, routeId));
    if (!snap.exists()) throw new Error('Route not found.');
    if (snap.data().ownerUid !== uid && !window.AuthUI?.isAdmin())
      throw new Error('Permission denied.');
    await deleteDoc(doc(db, ROUTES_COL, routeId));
  },

  /* ── VISIBILITY ── */
  async setRouteVisibility(routeId, isPublic, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const snap = await getDoc(doc(db, ROUTES_COL, routeId));
    if (!snap.exists()) throw new Error('Route not found.');
    if (snap.data().ownerUid !== uid && !window.AuthUI?.isAdmin())
      throw new Error('Permission denied.');
    await setDoc(doc(db, ROUTES_COL, routeId), { isPublic: Boolean(isPublic), updatedAt: serverTimestamp() }, { merge: true });
  },

  /* ── FETCH ── */
  async getMyRoutes(uid) {
    if (!uid) return [];
    const snap = await getDocs(query(collection(db, ROUTES_COL), where('ownerUid','==',uid), orderBy('updatedAt','desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getPublicRoutes({ limitCount = 200 } = {}) {
    const snap = await getDocs(query(collection(db, ROUTES_COL), where('isPublic','==',true), orderBy('updatedAt','desc'), limit(limitCount)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getRoute(routeId) {
    const snap = await getDoc(doc(db, ROUTES_COL, routeId));
    if (!snap.exists()) throw new Error('Route not found.');
    return { id: snap.id, ...snap.data() };
  },
  async getAllRoutes() {
    if (!window.AuthUI?.isAdmin()) throw new Error('Admin only.');
    const snap = await getDocs(collection(db, ROUTES_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* ── DOWNLOAD TRACKING ──
     Must be called when user loads a route into editor.
     Required before rating is allowed.
  ── */
  async recordDownload(routeId, uid) {
    if (!uid || !routeId) return;
    const ref = doc(db, ROUTES_COL, routeId, 'downloads', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, downloadedAt: serverTimestamp() });
      // Bump downloadCount on route doc (only aggregated field, passes isRatingAggregateUpdate rule if we add it — OR use setDoc+merge which is owner-gated... better approach: route-level only the rater aggregates. For downloadCount use setDoc+merge as admin or just track without updating parent)
      // Note: downloadCount update is best-effort only — not required for gate logic
      try {
        const routeSnap = await getDoc(doc(db, ROUTES_COL, routeId));
        if (routeSnap.exists()) {
          const cur = routeSnap.data().downloadCount || 0;
          await updateDoc(doc(db, ROUTES_COL, routeId), { downloadCount: cur + 1 });
        }
      } catch (_) { /* non-critical */ }
    }
  },

  async hasDownloaded(routeId, uid) {
    if (!uid || !routeId) return false;
    try {
      const snap = await getDoc(doc(db, ROUTES_COL, routeId, 'downloads', uid));
      return snap.exists();
    } catch (_) { return false; }
  },
  
  /* ── RATINGS ──
     totalBeans = raw sum of all ratings (e.g. 2 votes: 1+5=6 beans total)
     avgRating  = mean (3.0)
     ratingCount = number of votes (2)
  ── */
  async rateRoute(routeId, rating, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const routeRef = doc(db, ROUTES_COL, routeId);
    const ratingRef = doc(db, ROUTES_COL, routeId, 'ratings', uid);

    const routeSnap = await getDoc(routeRef);
    if (!routeSnap.exists()) throw new Error('Route not found.');

    const oldRatingSnap = await getDoc(ratingRef);
    const oldRating = oldRatingSnap.exists() ? oldRatingSnap.data().rating : null;

    const routeData = routeSnap.data();
    let count = routeData.ratingCount || 0;
    let totalBeans = routeData.totalBeans || 0;
    let runningTotal = (routeData.avgRating || 0) * count;

    if (oldRating !== null) {
      // Update existing rating
      runningTotal = runningTotal - oldRating + rating;
      totalBeans = totalBeans - oldRating + rating;
    } else {
      // New rating
      count += 1;
      runningTotal += rating;
      totalBeans += rating;
    }

    const avgRating = count > 0 ? Math.round((runningTotal / count) * 10) / 10 : 0;

    // Save user's rating
    await setDoc(ratingRef, { rating, uid, updatedAt: serverTimestamp() });

    // Update route aggregates
    await updateDoc(routeRef, {
      avgRating,
      ratingCount: count,
      totalBeans,
      updatedAt: serverTimestamp()
    });
  },

  async getMyRating(routeId, uid) {
    if (!uid) return null;
    try {
      const snap = await getDoc(doc(db, ROUTES_COL, routeId, 'ratings', uid));
      return snap.exists() ? snap.data().rating : null;
    } catch (_) { return null; }
  },

  /* ── FAVORITES ── */
  async toggleFavorite(routeId, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const favRef = doc(db, 'users', uid, 'favorites', routeId);
    const snap   = await getDoc(favRef);
    if (snap.exists()) { await deleteDoc(favRef); return false; }
    await setDoc(favRef, { routeId, addedAt: serverTimestamp() });
    return true;
  },

  async getMyFavorites(uid) {
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'favorites'));
    return snap.docs.map(d => d.id);
  },

  /* ── ADMIN SELF-PROMOTE ──
     Because Firestore rules require role=admin to already be set for admin writes,
     self-promotion must be done via Firebase Console. This function gives clear instructions.
     Steps: Firebase Console → Firestore → users → <your UID> → edit role field → "admin"
  ── */
  getAdminInstructions(uid) {
    return `To set yourself as admin:
1. Go to: https://console.firebase.google.com/project/okias-events/firestore
2. Browse to: users → ${uid || '(your UID shown after login)'}
3. Click the "role" field and change "user" → "admin"
4. Save, then refresh this page.`;
  }
};
