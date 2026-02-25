/**
 * main-overrides.js
 *
 * STORAGE MODEL
 * ─────────────
 * LOGGED IN  → Firestore only. On authStateChanged: fetch user's routes,
 *              render sidebar. Save = upsert by routeId (kept on the object).
 *              No localStorage for persistence.
 *
 * LOGGED OUT → localStorage only (key: mt_local_routes).
 *              Community loads land here. Everything is local-only.
 *              Sidebar shows local routes + a "sign in to sync" hint.
 *
 * Community load → always into localStorage + editor first.
 *                  If logged in: ☁ button appears to push it to Firestore.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
   * IN-MEMORY LIST  –  each entry:
   *   { id, routeName, routeData, isPublic, categories, _local }
   *   id     = Firestore doc ID, null when local-only
   *   _local = true  = not in Firestore yet
   * ───────────────────────────────────────────────────────────────────────── */
  let _routes    = [];   // the live list
  let _activeIdx = -1;   // index of currently loaded route
  let _activeEl  = null; // DOM element currently highlighted

  /* ── LOCAL STORAGE (logged-out persistence) ─────────────────────────────── */
  const LS_KEY = 'mt_local_routes';

  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function lsSave(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }
  function lsDel(routeName) { lsSave(lsLoad().filter(r => r.routeName !== routeName)); }
  function lsClear() {
    [LS_KEY, 'routeGroups', 'routes'].forEach(k => localStorage.removeItem(k));
  }
  function lsUpsert(routeName, routeData) {
    const list = lsLoad();
    const i    = list.findIndex(r => r.routeName === routeName);
    if (i >= 0) list[i] = { routeName, routeData };
    else list.push({ routeName, routeData });
    lsSave(list);
  }

  /* ── TOAST ─────────────────────────────────────────────────────────────── */
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg || 'Done';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ── CLIPBOARD ─────────────────────────────────────────────────────────── */
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied!'))
        .catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Copied!'); }
    catch (_) { showToast('Copy failed'); }
    ta.remove();
  }

  /* ── BLINK ──────────────────────────────────────────────────────────────── */
  function blinkEl(el) {
    if (!el) return;
    el.classList.remove('sidebar-blink'); void el.offsetWidth;
    el.classList.add('sidebar-blink');
    setTimeout(() => el && el.classList.remove('sidebar-blink'), 600);
  }

  /* ── HTML ESCAPE ────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── LOAD SIDEBAR DATA ─────────────────────────────────────────────────── */
  async function loadSidebar() {
    const user = window.AuthUI?.getCurrentUser();

    if (user) {
      // ── LOGGED IN: Firestore is truth ───────────────────────────────────
      try {
        const rows = await window.FirestoreRoutes.getMyRoutes(user.uid);
        _routes = rows.map(r => ({
          id:         r.id,
          routeName:  r.routeName,
          routeData:  r.routeData,
          isPublic:   r.isPublic,
          categories: r.categories || [],
          _local:     false
        }));
      } catch (err) {
        console.warn('Could not load Firestore routes:', err);
        _routes = [];
      }

      // Append any local routes not yet synced (e.g. community loads)
      lsLoad().forEach(lr => {
        if (!_routes.find(r => r.routeName === lr.routeName)) {
          _routes.push({
            id: null, routeName: lr.routeName, routeData: lr.routeData,
            isPublic: true, categories: [], _local: true
          });
        }
      });

    } else {
      // ── LOGGED OUT: localStorage only ───────────────────────────────────
      _routes = lsLoad().map(r => ({
        id: null, routeName: r.routeName, routeData: r.routeData,
        isPublic: true, categories: [], _local: true
      }));
    }

    renderTree();
  }

  /* ── RENDER SIDEBAR ────────────────────────────────────────────────────── */
  function renderTree() {
    const tree  = document.getElementById('route-tree');
    const empty = document.getElementById('route-empty');
    if (!tree) return;

    // Remove old items (keep non-item children like route-empty)
    tree.querySelectorAll('.route-parent').forEach(el => el.remove());

    if (!_routes.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    _routes.forEach((route, idx) => {
      const item = buildItem(route, idx);
      tree.appendChild(item);
      if (idx === _activeIdx) {
        item.classList.add('active');
        _activeEl = item;
      }
    });
  }

  function buildItem(route, idx) {
    // Re-use .route-parent which already has all needed CSS
    const item = document.createElement('div');
    item.className = 'route-parent' + (route._local ? ' route-local' : '');
    item.title = route.routeName;

    // Load / name button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'route-parent-load';
    const icon = route._local ? '📋' : '🗺';
    loadBtn.innerHTML =
      `<span class="route-icon">${icon}</span>` +
      `<span class="route-parent-name">${esc(route.routeName)}</span>`;
    loadBtn.onclick = () => { setActive(item, idx); loadIntoEditor(route.routeData); };
    item.appendChild(loadBtn);

    // ☁ push-to-cloud button (local-only routes when user is logged in)
    if (route._local && window.AuthUI?.getCurrentUser()) {
      const cloudBtn = document.createElement('button');
      cloudBtn.className = 'route-rename-btn';
      cloudBtn.title     = 'Save to cloud';
      cloudBtn.textContent = '☁';
      cloudBtn.onclick = async (e) => {
        e.stopPropagation();
        cloudBtn.disabled = true;
        try   { await persist(idx); renderTree(); showToast('Saved to cloud ☁'); }
        catch (err) { showToast('Cloud save failed: ' + err.message); cloudBtn.disabled = false; }
      };
      item.appendChild(cloudBtn);
    }

    // ✎ Rename
    const renBtn = document.createElement('button');
    renBtn.className   = 'route-rename-btn';
    renBtn.title       = 'Rename';
    renBtn.textContent = '✎';
    renBtn.onclick = (e) => {
      e.stopPropagation();
      startRename(loadBtn, route.routeName, async (newName) => {
        const oldName = route.routeName;
        route.routeName = newName;
        if (route.routeData) route.routeData.routeName = newName;
        // Update localStorage entry if it was there under the old name
        if (route._local) { lsDel(oldName); lsUpsert(newName, route.routeData); }
        try   { await persist(idx); renderTree(); showToast('Renamed!'); }
        catch (err) { showToast('Rename failed: ' + err.message); }
      });
    };
    item.appendChild(renBtn);

    // × Delete
    const delBtn = document.createElement('button');
    delBtn.className   = 'route-delete-btn';
    delBtn.title       = 'Delete';
    delBtn.textContent = '×';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${route.routeName}"?`)) return;
      await deleteRoute(idx);
    };
    item.appendChild(delBtn);

    // ☁ badge (already-synced cloud routes)
    if (!route._local) {
      const badge       = document.createElement('span');
      badge.className   = 'route-collapse-btn'; // re-use the muted small-text style
      badge.title       = 'Saved to cloud';
      badge.textContent = '☁';
      badge.style.cursor = 'default';
      item.appendChild(badge);
    }

    return item;
  }

  /* ── SET ACTIVE ────────────────────────────────────────────────────────── */
  function setActive(el, idx) {
    document.querySelectorAll('.route-parent').forEach(e => e.classList.remove('active'));
    if (el) el.classList.add('active');
    _activeEl  = el;
    _activeIdx = idx;
  }

  /* ── LOAD ROUTE INTO EDITOR ────────────────────────────────────────────── */
  function loadIntoEditor(routeData) {
    if (!routeData) return;
    const str      = JSON.stringify(routeData, null, 2);
    const inputEl  = document.getElementById('json_data');
    const outputEl = document.getElementById('output');
    if (inputEl)  inputEl.value  = str;
    if (outputEl) outputEl.value = str;
    if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
    if (RouteProcessor?.updateStateIndicators) RouteProcessor.updateStateIndicators(routeData._routeState || null);
    if (window.reflectRouteCategories) window.reflectRouteCategories(routeData);
  }

  /* ── PERSIST (Firestore when logged in, localStorage when not) ──────────── */
  async function persist(idx) {
    const route   = _routes[idx];
    const user    = window.AuthUI?.getCurrentUser();
    const userDoc = window.AuthUI?.getCurrentUserDoc();

    if (user && window.FirestoreRoutes) {
      // Firestore upsert
      const isPublicEl = document.getElementById('chkRoutePublic');
      const isPublic   = isPublicEl ? isPublicEl.checked : (route.isPublic ?? true);
      const categories = route.categories?.length
        ? route.categories
        : [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);

      const savedId = await window.FirestoreRoutes.saveRoute({
        routeName:  route.routeName,
        routeData:  route.routeData,
        isPublic,
        uid:        user.uid,
        inGameName: userDoc?.inGameName || '',
        routeId:    route.id || null,   // null = let Firestore upsert by name
        categories
      });
      route.id     = savedId;
      route._local = false;
      lsDel(route.routeName);  // remove from localStorage now it's in Firestore

    } else {
      // localStorage upsert (logged-out)
      lsUpsert(route.routeName, route.routeData);
    }
  }

  /* ── DELETE ────────────────────────────────────────────────────────────── */
  async function deleteRoute(idx) {
    const route = _routes[idx];
    const user  = window.AuthUI?.getCurrentUser();

    if (route.id && user && window.FirestoreRoutes) {
      try { await window.FirestoreRoutes.deleteRoute(route.id, user.uid); }
      catch (err) { showToast('Delete failed: ' + err.message); return; }
    }
    lsDel(route.routeName);

    _routes.splice(idx, 1);
    if      (_activeIdx === idx) { _activeIdx = -1; _activeEl = null; }
    else if (_activeIdx  >  idx) { _activeIdx--; }
    renderTree();
  }

  /* ── UPSERT IN MEMORY ──────────────────────────────────────────────────── */
  function upsertMemory(routeName, routeData) {
    const i = _routes.findIndex(r => r.routeName === routeName);
    if (i >= 0) { _routes[i].routeData = routeData; return i; }
    _routes.push({ id: null, routeName, routeData, isPublic: true, categories: [], _local: true });
    return _routes.length - 1;
  }

  /* ── RENAME INLINE INPUT ───────────────────────────────────────────────── */
  function startRename(loadBtn, currentName, onCommit) {
    const span = loadBtn.querySelector('.route-parent-name');
    if (!span) return;
    const input = document.createElement('input');
    input.type      = 'text';
    input.value     = currentName;
    input.className = 'route-rename-input';
    span.replaceWith(input);
    input.focus(); input.select();
    const commit = () => onCommit(input.value.trim() || currentName);
    input.onblur    = commit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); renderTree(); }
    };
  }

  /* ── SAVE ACTIVE (Inspector "Save Changes" button) ─────────────────────── */
  async function saveActive() {
    if (_activeIdx < 0 || !_routes[_activeIdx]) {
      showToast('No route selected'); return;
    }
    const raw = document.getElementById('output')?.value.trim() || '';
    if (!raw) { showToast('No output to save'); return; }

    let routeData;
    try { routeData = JSON.parse(raw); }
    catch (_) { showToast('Invalid JSON'); return; }

    const route      = _routes[_activeIdx];
    route.routeData  = routeData;
    route.categories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);

    const user = window.AuthUI?.getCurrentUser();
    try {
      await persist(_activeIdx);
      blinkEl(_activeEl);
      showToast(user ? 'Saved to cloud ☁' : 'Saved locally');
      renderTree();
      // Restore highlight after re-render
      setTimeout(() => {
        const items = document.querySelectorAll('.route-parent');
        if (items[_activeIdx]) setActive(items[_activeIdx], _activeIdx);
      }, 60);
    } catch (err) {
      showToast('Save failed: ' + err.message);
    }
  }

  /* ── OVERRIDE: RouteProcessor.saveRouteToLocalStorage ──────────────────── *
   * Called by RouteProcessor.process() with the processed route.             *
   * We intercept to store in our system instead of raw localStorage.         *
   * ───────────────────────────────────────────────────────────────────────── */
  RouteProcessor.saveRouteToLocalStorage = async function (routeName, routeData) {
    const idx = upsertMemory(routeName, routeData);
    renderTree();

    try { await persist(idx); renderTree(); }
    catch (err) { console.warn('Auto-persist failed:', err.message); }

    setTimeout(() => {
      const items = document.querySelectorAll('.route-parent');
      if (items[idx]) { setActive(items[idx], idx); blinkEl(items[idx]); }
    }, 60);

    RouteProcessor.triggerBlink('saveCacheBtn');
  };

  RouteProcessor.updateRouteList = function () { renderTree(); };

  /* ── WIRE BUTTONS ──────────────────────────────────────────────────────── */

  const saveWpBtn = document.getElementById('btnSaveWaypoint');
  if (saveWpBtn) saveWpBtn.onclick = saveActive;

  document.getElementById('clearCacheBtn').onclick = () => {
    const user = window.AuthUI?.getCurrentUser();
    const msg  = user
      ? 'Remove all unsynced local routes from this browser?\n(Your cloud routes are not affected.)'
      : 'Delete all locally saved routes? This cannot be undone.';
    if (!confirm(msg)) return;
    lsClear();
    if (user) {
      // Keep Firestore-backed routes, drop local-only
      _routes = _routes.filter(r => !r._local);
    } else {
      _routes = [];
    }
    _activeIdx = -1; _activeEl = null;
    renderTree();
  };

  document.getElementById('copyOutputBtn').onclick = () =>
    copyText(document.getElementById('output')?.value || '');

  document.getElementById('importFromWebBtn').onclick = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text.startsWith('{') && !text.startsWith('[')) throw new Error('Not JSON');
      document.getElementById('json_data').value = text;
      document.getElementById('output').value    = text;
      if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
      showToast('Route imported!');
    } catch (_) {
      // Clipboard unavailable — switch to JSON tab so user can paste manually
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      const tab = document.querySelector('[data-pane="pane-json"]');
      if (tab) {
        tab.classList.add('on');
        document.getElementById('pane-json').classList.add('on');
      }
      document.getElementById('json_data')?.focus();
      showToast('Paste your JSON in the Input box');
    }
  };

  document.getElementById('exportToWebBtn').onclick = () => {
    const text = document.getElementById('output')?.value.trim() || '';
    if (!text) { showToast('No output to export yet'); return; }
    copyText(text);
  };

  /* ── AUTH STATE CHANGES ─────────────────────────────────────────────────── */
  document.addEventListener('authStateChanged', async () => {
    const visRow = document.getElementById('routeVisibilityRow');
    if (visRow) visRow.style.display = window.AuthUI?.getCurrentUser() ? 'flex' : 'none';
    _activeIdx = -1; _activeEl = null;
    await loadSidebar();
  });

  /* ── COMMUNITY ROUTE HANDOFF ──────────────────────────────────────────────
   * sessionStorage set by community.js before redirecting.
   * Runs at bottom of this file — after all overrides are wired.
   * ─────────────────────────────────────────────────────────────────────── */
  (function applyCommunityRoute() {
    const raw = sessionStorage.getItem('communityRouteLoad');
    if (!raw) return;
    sessionStorage.removeItem('communityRouteLoad');

    let routeData;
    try { routeData = JSON.parse(raw); }
    catch (_) { return; }
    if (!routeData?.waypoints?.length) return;

    // 1. Always save to localStorage immediately (works before auth resolves)
    const routeName = routeData.routeName || 'Community Route';
    lsUpsert(routeName, routeData);

    // 2. Populate both textareas
    const str = JSON.stringify(routeData, null, 2);
    const inp = document.getElementById('json_data');
    const out = document.getElementById('output');
    if (inp) inp.value = str;
    if (out) out.value = str;

    // 3. Add to in-memory list
    const memIdx = upsertMemory(routeName, routeData);

    // 4. Reflect categories and state badges
    if (window.reflectRouteCategories) window.reflectRouteCategories(routeData);
    if (RouteProcessor?.updateStateIndicators) RouteProcessor.updateStateIndicators(routeData._routeState || null);

    requestAnimationFrame(() => {
      // 5. Draw the map
      if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();

      // 6. Switch to Process tab (map view)
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      const pt = document.querySelector('.tab[data-pane="pane-process"]');
      const pp = document.getElementById('pane-process');
      if (pt) pt.classList.add('on');
      if (pp) pp.classList.add('on');

      // 7. Render sidebar and highlight the new entry
      renderTree();
      setTimeout(() => {
        const items = document.querySelectorAll('.route-parent');
        if (items[memIdx]) setActive(items[memIdx], memIdx);
      }, 60);

      showToast('Community route loaded!');
    });
  })();

  /* ── INITIAL RENDER ─────────────────────────────────────────────────────── *
   * Show local routes immediately. authStateChanged will replace this with    *
   * Firestore routes once auth resolves (usually within 1-2 seconds).         *
   * ─────────────────────────────────────────────────────────────────────── */
  _routes = lsLoad().map(r => ({
    id: null, routeName: r.routeName, routeData: r.routeData,
    isPublic: true, categories: [], _local: true
  }));
  renderTree();

})();
