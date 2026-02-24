/**
 * firestore-routes.js
 * Wraps all Firestore read/write operations for routes.
 * When the user is logged in, routes are synced to Firestore.
 * When logged out, callers fall back to localStorage (handled in main-overrides.js).
 *
 * Security model:
 *  - Writes only allowed when authenticated (enforced by Firestore rules + client guard)
 *  - Route data is validated before every write (structure + size limits)
 *  - No raw strings stored — routeData is a structured Firestore map
 *  - Rate-limit: min 5 s between saves per session (client-side; rules enforce server-side too)
 *
 * Exposes: window.FirestoreRoutes
 */

import { db }                                         from './firebase-config.js';
import {
  collection, doc,
  addDoc, setDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const ROUTES_COL   = 'routes';
const MAX_NAME_LEN = 128;
const MAX_WP_COUNT = 500;      // sanity cap on waypoints
const MAX_WP_FIELDS = 4;       // each waypoint: rotation, translation, scale3D, (optional extras ignored)
const MIN_SAVE_MS   = 5000;    // ms between saves (client-side rate limit)

let _lastSaveTime = 0;

// ── Validation ────────────────────────────────────────────────────────────────
/**
 * Validates and sanitizes a route object before writing to Firestore.
 * Returns { ok: true, data } or { ok: false, error: string }
 */
function validateRouteData(routeData) {
  if (!routeData || typeof routeData !== 'object') {
    return { ok: false, error: 'Route data must be an object.' };
  }
  if (!Array.isArray(routeData.waypoints)) {
    return { ok: false, error: 'Route must have a waypoints array.' };
  }
  if (routeData.waypoints.length === 0) {
    return { ok: false, error: 'Route must have at least one waypoint.' };
  }
  if (routeData.waypoints.length > MAX_WP_COUNT) {
    return { ok: false, error: `Too many waypoints (max ${MAX_WP_COUNT}).` };
  }

  // Validate each waypoint — only keep known safe fields
  const cleanWaypoints = routeData.waypoints.map((wp, i) => {
    if (!wp || typeof wp !== 'object') throw new Error(`Waypoint ${i} is not an object.`);

    const rot = wp.rotation;
    const tr  = wp.translation;
    const sc  = wp.scale3D;

    if (!rot || typeof rot !== 'object') throw new Error(`Waypoint ${i} missing rotation.`);
    if (!tr  || typeof tr  !== 'object') throw new Error(`Waypoint ${i} missing translation.`);

    return {
      rotation: {
        x: Number(rot.x) || 0,
        y: Number(rot.y) || 0,
        z: Number(rot.z) || 0,
        w: Number(rot.w) ?? 1
      },
      translation: {
        x: Number(tr.x) || 0,
        y: Number(tr.y) || 0,
        z: Number(tr.z) || 0
      },
      scale3D: sc ? {
        x: Number(sc.x) || 1,
        y: Number(sc.y) || 10,
        z: Number(sc.z) || 1
      } : { x: 1, y: 10, z: 1 }
    };
  });

  return {
    ok: true,
    data: {
      routeName: String(routeData.routeName || 'Unnamed').slice(0, MAX_NAME_LEN),
      waypoints: cleanWaypoints
    }
  };
}

function sanitizeName(str) {
  return String(str || '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, MAX_NAME_LEN) || 'Unnamed';
}

// ── Public API ────────────────────────────────────────────────────────────────
window.FirestoreRoutes = {

  /**
   * Save a route to Firestore.
   * If routeId is provided, updates that document; otherwise creates a new one.
   * Returns the document ID on success, or throws.
   */
  async saveRoute({ routeName, routeData, isPublic = true, uid, inGameName, routeId = null }) {
    if (!uid) throw new Error('Must be logged in to save routes.');

    // Client-side rate limit
    const now = Date.now();
    if (now - _lastSaveTime < MIN_SAVE_MS) {
      throw new Error('Saving too fast — please wait a moment.');
    }

    const validation = validateRouteData(routeData);
    if (!validation.ok) throw new Error(validation.error);

    const payload = {
      ownerUid:      uid,
      characterId:   uid,           // 1:1 mapping (one character per account)
      inGameName:    sanitizeName(inGameName),
      routeName:     sanitizeName(routeName),
      routeData:     validation.data,
      isPublic:      Boolean(isPublic),
      waypointCount: validation.data.waypoints.length,
      updatedAt:     serverTimestamp()
    };

    let savedId;
    if (routeId) {
      // Update existing — verify ownership first
      const existing = await getDoc(doc(db, ROUTES_COL, routeId));
      if (!existing.exists()) throw new Error('Route not found.');
      if (existing.data().ownerUid !== uid && !window.AuthUI?.isAdmin()) {
        throw new Error('Permission denied.');
      }
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

  /**
   * Delete a route by ID.
   * Only owner or admin can delete.
   */
  async deleteRoute(routeId, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const ref  = doc(db, ROUTES_COL, routeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Route not found.');
    if (snap.data().ownerUid !== uid && !window.AuthUI?.isAdmin()) {
      throw new Error('Permission denied.');
    }
    await deleteDoc(ref);
  },

  /**
   * Toggle a route's public/private visibility.
   */
  async setRouteVisibility(routeId, isPublic, uid) {
    if (!uid) throw new Error('Must be logged in.');
    const ref  = doc(db, ROUTES_COL, routeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Route not found.');
    if (snap.data().ownerUid !== uid && !window.AuthUI?.isAdmin()) {
      throw new Error('Permission denied.');
    }
    await setDoc(ref, { isPublic: Boolean(isPublic), updatedAt: serverTimestamp() }, { merge: true });
  },

  /**
   * Fetch all routes belonging to the current user.
   */
  async getMyRoutes(uid) {
    if (!uid) return [];
    const q    = query(
      collection(db, ROUTES_COL),
      where('ownerUid', '==', uid),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Fetch all public routes (for community browser).
   * Supports optional filters: authorUid, searchName.
   */
  async getPublicRoutes({ limitCount = 100, authorUid = null } = {}) {
    let q = query(
      collection(db, ROUTES_COL),
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    if (authorUid) {
      q = query(
        collection(db, ROUTES_COL),
        where('isPublic', '==', true),
        where('ownerUid', '==', authorUid),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Fetch a single route by ID (public or owned).
   */
  async getRoute(routeId) {
    const snap = await getDoc(doc(db, ROUTES_COL, routeId));
    if (!snap.exists()) throw new Error('Route not found.');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Admin: get all routes regardless of visibility.
   */
  async getAllRoutes(uid) {
    if (!window.AuthUI?.isAdmin()) throw new Error('Admin only.');
    const snap = await getDocs(collection(db, ROUTES_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};
