/**
 * community.js
 * Drives the community route browser (community.html).
 * Explorer/Total Commander style: left filter panel, right sortable table,
 * bottom detail panel when a row is selected.
 */

import { auth }                                    from './firebase-config.js';
import { onAuthStateChanged }                      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ── Wait for AuthUI to initialize ── */
  window.AuthUI?.init();

  /* ── State ── */
  let _allRoutes   = [];
  let _filtered    = [];
  let _sortCol     = 'updatedAt';
  let _sortDir     = 'desc';   // 'asc' | 'desc'
  let _selectedId  = null;

  /* ── DOM refs ── */
  const searchInput    = document.getElementById('searchInput');
  const authorInput    = document.getElementById('authorInput');
  const sortSelect     = document.getElementById('sortSelect');
  const chkMyRoutes    = document.getElementById('chkMyRoutes');
  const btnApply       = document.getElementById('btnApplyFilters');
  const btnReset       = document.getElementById('btnResetFilters');
  const btnRefresh     = document.getElementById('btnRefresh');
  const routeCount     = document.getElementById('routeCount');
  const tbody          = document.getElementById('routeTableBody');
  const routeDetail    = document.getElementById('route-detail');
  const detailName     = document.getElementById('detailName');
  const detailMeta     = document.getElementById('detail-meta');
  const detailJson     = document.getElementById('detailJson');
  const btnLoadRoute   = document.getElementById('btnLoadRoute');
  const btnCopyRoute   = document.getElementById('btnCopyRoute');
  const btnToggleVis   = document.getElementById('btnToggleVis');
  const btnAdminDelete = document.getElementById('btnAdminDelete');
  const btnCloseDetail = document.getElementById('btnCloseDetail');
  const adminPanel     = document.getElementById('adminPanel');
  const btnShowAll     = document.getElementById('btnShowAll');

  /* ── Load routes ── */
  async function loadRoutes(showAll = false) {
    routeCount.textContent = 'Loading…';
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading…</td></tr>';

    try {
      if (showAll && window.AuthUI?.isAdmin()) {
        _allRoutes = await window.FirestoreRoutes.getAllRoutes(window.AuthUI.getCurrentUser()?.uid);
      } else {
        _allRoutes = await window.FirestoreRoutes.getPublicRoutes({ limitCount: 200 });
      }
      applyFilters();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:#ff5555;">Error: ${escHtml(err.message)}</td></tr>`;
      routeCount.textContent = 'Error loading routes';
    }
  }

  /* ── Filter & sort ── */
  function applyFilters() {
    const search   = searchInput.value.trim().toLowerCase();
    const author   = authorInput.value.trim().toLowerCase();
    const myOnly   = chkMyRoutes.checked;
    const uid      = window.AuthUI?.getCurrentUser()?.uid;

    _filtered = _allRoutes.filter(r => {
      if (myOnly && r.ownerUid !== uid)                                 return false;
      if (search && !r.routeName.toLowerCase().includes(search))        return false;
      if (author && !r.inGameName.toLowerCase().includes(author))       return false;
      return true;
    });

    sortRoutes();
    renderTable();
  }

  function sortRoutes() {
    _filtered.sort((a, b) => {
      let va = a[_sortCol], vb = b[_sortCol];
      // Firestore Timestamps → number
      if (va?.seconds) va = va.seconds;
      if (vb?.seconds) vb = vb.seconds;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return _sortDir === 'asc' ? -1 :  1;
      if (va > vb) return _sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  /* ── Render table ── */
  function renderTable() {
    routeCount.textContent = `${_filtered.length} route${_filtered.length !== 1 ? 's' : ''}`;

    if (!_filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No routes found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    _filtered.forEach(route => {
      const tr = document.createElement('tr');
      tr.dataset.id = route.id;
      if (route.id === _selectedId) tr.classList.add('selected');
      if (!route.isPublic) tr.classList.add('row-hidden');

      const updatedAt = formatDate(route.updatedAt);

      tr.innerHTML = `
        <td class="col-name">
          ${escHtml(route.routeName)}
          ${!route.isPublic ? '<span class="badge-hidden">Hidden</span>' : ''}
        </td>
        <td class="col-author">${escHtml(route.inGameName || '—')}</td>
        <td class="col-wps">${route.waypointCount ?? '?'}</td>
        <td class="col-date">${updatedAt}</td>
        <td class="col-actions">
          <button class="btn-ghost btn-xs btn-load-inline" data-id="${route.id}">Load</button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-load-inline')) {
          loadRouteInEditor(route);
          return;
        }
        selectRoute(route);
      });

      tbody.appendChild(tr);
    });

    // Re-highlight if the selected row is in the current results
    if (_selectedId) {
      const existingRow = tbody.querySelector(`tr[data-id="${_selectedId}"]`);
      if (existingRow) existingRow.classList.add('selected');
    }
  }

  /* ── Select route (show detail panel) ── */
  function selectRoute(route) {
    _selectedId = route.id;

    // Highlight row
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-id="${route.id}"]`);
    if (row) row.classList.add('selected');

    // Fill detail panel
    detailName.textContent = route.routeName;
    detailMeta.innerHTML = `
      <span class="meta-item">👤 ${escHtml(route.inGameName || 'Unknown')}</span>
      <span class="meta-item">📍 ${route.waypointCount ?? '?'} waypoints</span>
      <span class="meta-item">🕐 ${formatDate(route.updatedAt)}</span>
      <span class="meta-item">${route.isPublic ? '🌐 Public' : '🔒 Hidden'}</span>
    `;

    // Show preview of first 5 waypoints to avoid massive JSON blobs
    const preview = route.routeData ? {
      routeName: route.routeData.routeName,
      waypoints: route.routeData.waypoints?.slice(0, 5),
      _note: route.waypointCount > 5 ? `... and ${route.waypointCount - 5} more waypoints` : undefined
    } : null;
    detailJson.textContent = JSON.stringify(preview, null, 2);

    // Show/hide owner & admin controls
    const uid        = window.AuthUI?.getCurrentUser()?.uid;
    const isOwner    = route.ownerUid === uid;
    const isAdmin    = window.AuthUI?.isAdmin();

    btnToggleVis.style.display   = (isOwner || isAdmin) ? 'inline-flex' : 'none';
    btnAdminDelete.style.display = isAdmin ? 'inline-flex' : 'none';
    btnToggleVis.textContent     = route.isPublic ? '🔒 Make Hidden' : '🌐 Make Public';

    routeDetail.style.display = 'block';
  }

  function closeDetail() {
    routeDetail.style.display = 'none';
    _selectedId = null;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
  }

  /* ── Load route into editor ── */
  function loadRouteInEditor(route) {
    if (!route.routeData) { showToast('No route data available'); return; }
    const json = JSON.stringify(route.routeData, null, 2);
    sessionStorage.setItem('pendingRouteLoad', json);
    window.location.href = 'index.html?load=community';
    showToast('Opening in editor…');
  }

  /* ── Copy JSON ── */
  function copyRouteJson() {
    const route = _filtered.find(r => r.id === _selectedId);
    if (!route?.routeData) { showToast('No route selected'); return; }
    const text = JSON.stringify(route.routeData, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Copied!');
    }
  }

  /* ── Toggle visibility ── */
  async function toggleVisibility() {
    const route = _filtered.find(r => r.id === _selectedId);
    if (!route) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid) { showToast('Sign in first'); return; }
    try {
      btnToggleVis.disabled = true;
      await window.FirestoreRoutes.setRouteVisibility(route.id, !route.isPublic, uid);
      showToast(route.isPublic ? 'Route hidden' : 'Route is now public');
      await loadRoutes();
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      btnToggleVis.disabled = false;
    }
  }

  /* ── Admin delete ── */
  async function adminDelete() {
    const route = _filtered.find(r => r.id === _selectedId);
    if (!route) return;
    if (!confirm(`Admin delete "${route.routeName}" by ${route.inGameName}? This cannot be undone.`)) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    try {
      await window.FirestoreRoutes.deleteRoute(route.id, uid);
      showToast('Route deleted');
      closeDetail();
      await loadRoutes();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  /* ── Column sort ── */
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (_sortCol === col) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortCol = col;
        _sortDir = col === 'updatedAt' ? 'desc' : 'asc';
      }
      sortSelect.value = _sortCol;
      updateSortArrows();
      sortRoutes();
      renderTable();
    });
  });

  function updateSortArrows() {
    document.querySelectorAll('th.sortable').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (!arrow) return;
      if (th.dataset.col === _sortCol) {
        arrow.textContent = _sortDir === 'asc' ? ' ▲' : ' ▼';
        th.classList.add('sort-active');
      } else {
        arrow.textContent = '';
        th.classList.remove('sort-active');
      }
    });
  }

  /* ── Event wiring ── */
  btnApply.addEventListener('click', applyFilters);
  btnReset.addEventListener('click', () => {
    searchInput.value = '';
    authorInput.value = '';
    chkMyRoutes.checked = false;
    sortSelect.value = 'updatedAt';
    _sortCol = 'updatedAt';
    _sortDir = 'desc';
    updateSortArrows();
    applyFilters();
  });
  btnRefresh.addEventListener('click', () => loadRoutes());
  btnLoadRoute.addEventListener('click', () => {
    const route = _filtered.find(r => r.id === _selectedId);
    if (route) loadRouteInEditor(route);
  });
  btnCopyRoute.addEventListener('click', copyRouteJson);
  btnToggleVis.addEventListener('click', toggleVisibility);
  btnAdminDelete.addEventListener('click', adminDelete);
  btnCloseDetail.addEventListener('click', closeDetail);
  btnShowAll?.addEventListener('click', () => loadRoutes(true));

  // Enter key on filter inputs
  [searchInput, authorInput].forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });
  });

  // Sort select dropdown (syncs with column clicks)
  sortSelect.addEventListener('change', () => {
    _sortCol = sortSelect.value;
    updateSortArrows();
    sortRoutes();
    renderTable();
  });

  /* ── Auth state ── */
  document.addEventListener('authStateChanged', (e) => {
    const loggedIn = !!e.detail?.user;
    if (window.AuthUI?.isAdmin()) {
      adminPanel.style.display = 'block';
    }
    if (loggedIn) {
      // Re-load so "My routes only" checkbox works
      loadRoutes();
    }
  });

  /* ── Handle pending route load from community page ── */
  // (This runs on index.html when redirected back from community)
  if (window.location.search.includes('load=community')) {
    const pending = sessionStorage.getItem('pendingRouteLoad');
    if (pending) {
      sessionStorage.removeItem('pendingRouteLoad');
      // Populate editor fields
      const inputEl  = document.getElementById('json_data');
      const outputEl = document.getElementById('output');
      if (inputEl)  inputEl.value  = pending;
      if (outputEl) outputEl.value = pending;
      if (window.MapVisualizerInstance) {
        window.MapVisualizerInstance.loadFromOutput();
      }
      showToast('Community route loaded!');
    }
  }

  /* ── Helpers ── */
  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ── Initial load ── */
  updateSortArrows();
  loadRoutes();

});
