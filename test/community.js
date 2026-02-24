/**
 * community.js
 * Community route browser logic.
 * Fix: "Load in Editor" uses sessionStorage; index.html reads it on load.
 */

import { auth } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {

  window.AuthUI?.init();

  /* ── State ── */
  let _allRoutes  = [];
  let _filtered   = [];
  let _sortCol    = 'updatedAt';
  let _sortDir    = 'desc';
  let _selectedId = null;

  /* ── DOM ── */
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

  /* ── Load routes from Firestore ── */
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
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:#d95050;">Error: ${escHtml(err.message)}</td></tr>`;
      routeCount.textContent = 'Error';
    }
  }

  /* ── Filter ── */
  function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const author = authorInput.value.trim().toLowerCase();
    const myOnly = chkMyRoutes.checked;
    const uid    = window.AuthUI?.getCurrentUser()?.uid;

    _filtered = _allRoutes.filter(r => {
      if (myOnly && r.ownerUid !== uid)                          return false;
      if (search && !r.routeName?.toLowerCase().includes(search)) return false;
      if (author && !r.inGameName?.toLowerCase().includes(author)) return false;
      return true;
    });

    sortRoutes();
    renderTable();
  }

  /* ── Sort ── */
  function sortRoutes() {
    _filtered.sort((a, b) => {
      let va = a[_sortCol], vb = b[_sortCol];
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

      tr.innerHTML = `
        <td class="col-name">
          ${escHtml(route.routeName || 'Unnamed')}
          ${!route.isPublic ? '<span class="badge-hidden">Hidden</span>' : ''}
        </td>
        <td class="col-author">${escHtml(route.inGameName || '—')}</td>
        <td class="col-wps">${route.waypointCount ?? '?'}</td>
        <td class="col-date">${formatDate(route.updatedAt)}</td>
        <td class="col-actions">
          <button class="btn-secondary btn-sm btn-load-inline" data-id="${route.id}">⬇</button>
        </td>
      `;

      // Row click → select (but not if clicking the inline load button)
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-load-inline')) {
          loadRouteInEditor(route);
          return;
        }
        selectRoute(route);
      });

      tbody.appendChild(tr);
    });
  }

  /* ── Select row → show detail panel ── */
  function selectRoute(route) {
    _selectedId = route.id;

    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-id="${route.id}"]`);
    if (row) row.classList.add('selected');

    detailName.textContent = route.routeName || 'Unnamed';
    detailMeta.innerHTML = `
      <span class="meta-item">👤 ${escHtml(route.inGameName || 'Unknown')}</span>
      <span class="meta-item">📍 ${route.waypointCount ?? '?'} waypoints</span>
      <span class="meta-item">🕐 ${formatDate(route.updatedAt)}</span>
      <span class="meta-item">${route.isPublic ? '🌐 Public' : '🔒 Hidden'}</span>
    `;

    // Preview first 3 waypoints only
    const preview = route.routeData ? {
      routeName: route.routeData.routeName,
      waypoints: `[ ${route.waypointCount} waypoints — use Load to get full data ]`
    } : { note: 'No preview available' };
    detailJson.textContent = JSON.stringify(preview, null, 2);

    const uid     = window.AuthUI?.getCurrentUser()?.uid;
    const isOwner = route.ownerUid === uid;
    const isAdmin = window.AuthUI?.isAdmin();
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

  /* ── Load route in editor ── */
  // Stores the full routeData in sessionStorage then navigates to index.html
  // index.html reads it on DOMContentLoaded via the snippet in main.js
  function loadRouteInEditor(route) {
    if (!route?.routeData) { showToast('No route data'); return; }
    try {
      sessionStorage.setItem('communityRouteLoad', JSON.stringify(route.routeData));
      window.location.href = 'index.html';
    } catch (e) {
      showToast('Could not load: ' + e.message);
    }
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
    btnToggleVis.disabled = true;
    try {
      await window.FirestoreRoutes.setRouteVisibility(route.id, !route.isPublic, uid);
      showToast(route.isPublic ? 'Route hidden' : 'Route is now public');
      closeDetail();
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
    if (!confirm(`Delete "${route.routeName}" by ${route.inGameName}? Cannot be undone.`)) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    try {
      await window.FirestoreRoutes.deleteRoute(route.id, uid);
      showToast('Deleted');
      closeDetail();
      await loadRoutes();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  /* ── Column sort headers ── */
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      _sortDir = (_sortCol === col && _sortDir === 'asc') ? 'desc' : 'asc';
      if (_sortCol !== col) { _sortCol = col; _sortDir = col === 'updatedAt' ? 'desc' : 'asc'; }
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
        arrow.textContent = _sortDir === 'asc' ? '▲' : '▼';
        th.classList.add('sort-active');
      } else {
        arrow.textContent = '';
        th.classList.remove('sort-active');
      }
    });
  }

  /* ── Wire buttons ── */
  btnApply.addEventListener('click', applyFilters);
  btnReset.addEventListener('click', () => {
    searchInput.value = '';
    authorInput.value = '';
    chkMyRoutes.checked = false;
    _sortCol = 'updatedAt'; _sortDir = 'desc';
    sortSelect.value = 'updatedAt';
    updateSortArrows();
    applyFilters();
  });
  btnRefresh.addEventListener('click', () => loadRoutes());
  btnLoadRoute.addEventListener('click', () => {
    const route = _filtered.find(r => r.id === _selectedId);
    if (route) loadRouteInEditor(route);
  });
  btnCopyRoute.addEventListener('click',   copyRouteJson);
  btnToggleVis.addEventListener('click',   toggleVisibility);
  btnAdminDelete.addEventListener('click', adminDelete);
  btnCloseDetail.addEventListener('click', closeDetail);
  btnShowAll?.addEventListener('click',    () => loadRoutes(true));

  [searchInput, authorInput].forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); })
  );
  sortSelect.addEventListener('change', () => {
    _sortCol = sortSelect.value;
    updateSortArrows();
    sortRoutes();
    renderTable();
  });

  /* ── Auth state changes ── */
  document.addEventListener('authStateChanged', () => {
    adminPanel.style.display = window.AuthUI?.isAdmin() ? 'block' : 'none';
    loadRoutes();
  });

  /* ── Helpers ── */
  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
