/**
 * community.js
 * Community route browser logic.
 * Fix: "Load in Editor" uses sessionStorage; index.html reads it on load.
 * Features: categories filter, bean ratings (1-5), favorites
 */

import { auth } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {

  window.AuthUI?.init();

  /* ── State ── */
  let _allRoutes    = [];
  let _filtered     = [];
  let _sortCol      = 'updatedAt';
  let _sortDir      = 'desc';
  let _selectedId   = null;
  let _myFavorites  = new Set();
  let _myRating     = null;  // rating for currently selected route
  let _activeCatFilter = null;  // single category filter

  /* ── DOM ── */
  const searchInput    = document.getElementById('searchInput');
  const authorInput    = document.getElementById('authorInput');
  const sortSelect     = document.getElementById('sortSelect');
  const chkMyRoutes    = document.getElementById('chkMyRoutes');
  const chkFavsOnly    = document.getElementById('chkFavsOnly');
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
  const catFilterBar   = document.getElementById('catFilterBar');

  /* ── Category filter bar ── */
  const CATS = ['Sprint','Circuit','Endurance','Offroad','Dakar','Hills','Technical','Speed'];
  const CAT_CLASSES = {
    Sprint:'tag-sprint', Circuit:'tag-circuit', Endurance:'tag-endurance',
    Offroad:'tag-offroad', Dakar:'tag-dakar', Hills:'tag-hills',
    Technical:'tag-technical', Speed:'tag-speed'
  };
  if (catFilterBar) {
    CATS.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-toggle ${CAT_CLASSES[cat]}`;
      btn.dataset.cat = cat;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        if (_activeCatFilter === cat) {
          _activeCatFilter = null;
          btn.classList.remove('on');
        } else {
          _activeCatFilter = cat;
          catFilterBar.querySelectorAll('.cat-toggle').forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
        }
        applyFilters();
      });
      catFilterBar.appendChild(btn);
    });
  }

  /* ── Load routes from Firestore ── */
  async function loadRoutes(showAll = false) {
    routeCount.textContent = 'Loading…';
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading…</td></tr>';
    try {
      if (showAll && window.AuthUI?.isAdmin()) {
        _allRoutes = await window.FirestoreRoutes.getAllRoutes(window.AuthUI.getCurrentUser()?.uid);
      } else {
        _allRoutes = await window.FirestoreRoutes.getPublicRoutes({ limitCount: 200 });
      }
      // Load favorites
      const uid = window.AuthUI?.getCurrentUser()?.uid;
      if (uid && window.FirestoreRoutes?.getMyFavorites) {
        const favIds = await window.FirestoreRoutes.getMyFavorites(uid);
        _myFavorites = new Set(favIds);
      }
      applyFilters();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty" style="color:#d95050;">Error: ${escHtml(err.message)}</td></tr>`;
      routeCount.textContent = 'Error';
    }
  }

  /* ── Filter ── */
  function applyFilters() {
    const search  = searchInput.value.trim().toLowerCase();
    const author  = authorInput.value.trim().toLowerCase();
    const myOnly  = chkMyRoutes.checked;
    const favOnly = chkFavsOnly?.checked;
    const uid     = window.AuthUI?.getCurrentUser()?.uid;

    _filtered = _allRoutes.filter(r => {
      if (myOnly && r.ownerUid !== uid)                          return false;
      if (favOnly && !_myFavorites.has(r.id))                   return false;
      if (search && !r.routeName?.toLowerCase().includes(search)) return false;
      if (author && !r.inGameName?.toLowerCase().includes(author)) return false;
      if (_activeCatFilter && !(r.categories || []).includes(_activeCatFilter)) return false;
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
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No routes found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    _filtered.forEach(route => {
      const tr = document.createElement('tr');
      tr.dataset.id = route.id;
      if (route.id === _selectedId) tr.classList.add('selected');
      if (!route.isPublic) tr.classList.add('row-hidden');

      const cats = (route.categories || []).slice(0, 3);
      const catHtml = cats.map(c => `<span class="route-tag ${CAT_CLASSES[c] || ''}">${escHtml(c)}</span>`).join('');

      const isFav = _myFavorites.has(route.id);
      const rating = route.avgRating || 0;
      const beansHtml = renderBeansHtml(rating, route.ratingCount || 0);

      tr.innerHTML = `
        <td class="col-name">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
            ${escHtml(route.routeName || 'Unnamed')}
            ${!route.isPublic ? '<span class="badge-hidden">Hidden</span>' : ''}
          </div>
          ${catHtml ? `<div style="display:flex;gap:2px;margin-top:3px;flex-wrap:wrap;">${catHtml}</div>` : ''}
        </td>
        <td class="col-author">${escHtml(route.inGameName || '—')}</td>
        <td class="col-wps">${route.waypointCount ?? '?'}</td>
        <td class="col-rating">${beansHtml}</td>
        <td class="col-date">${formatDate(route.updatedAt)}</td>
        <td class="col-actions" style="display:flex;gap:3px;align-items:center;">
          <button class="btn-fav ${isFav ? 'faved' : ''}" data-id="${route.id}" title="${isFav ? 'Unfavorite' : 'Favorite'}">⭐</button>
          <button class="btn-secondary btn-sm btn-load-inline" data-id="${route.id}">⬇</button>
        </td>
      `;

      // Fav button
      tr.querySelector('.btn-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(route.id);
      });

      // Row click → select
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-load-inline')) { loadRouteInEditor(route); return; }
        if (e.target.closest('.btn-fav')) return;
        selectRoute(route);
      });

      tbody.appendChild(tr);
    });
  }

  function renderBeansHtml(avg, count) {
    const full = Math.round(avg);
    let html = '<span class="bean-rating" style="pointer-events:none;">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${i <= full ? 'filled' : ''}">🫘</span>`;
    }
    html += `<span class="bean-count">${count > 0 ? avg.toFixed(1) : '—'}</span></span>`;
    return html;
  }

  function renderInteractiveBeansHtml(myRating) {
    let html = '<div class="bean-rating" id="myRatingBeans" style="cursor:pointer;">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${myRating && i <= myRating ? 'filled' : ''}" data-val="${i}" title="${i} bean${i>1?'s':''}">🫘</span>`;
    }
    html += '</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">' + (myRating ? `Your rating: ${myRating}` : 'Click to rate') + '</div>';
    return html;
  }

  /* ── Select row → show detail panel ── */
  async function selectRoute(route) {
    _selectedId = route.id;
    _myRating   = null;

    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-id="${route.id}"]`);
    if (row) row.classList.add('selected');

    detailName.textContent = route.routeName || 'Unnamed';

    const cats = (route.categories || []);
    const catHtml = cats.map(c => `<span class="route-tag ${CAT_CLASSES[c] || ''}">${escHtml(c)}</span>`).join('');

    detailMeta.innerHTML = `
      <span class="meta-item">👤 ${escHtml(route.inGameName || 'Unknown')}</span>
      <span class="meta-item">📍 ${route.waypointCount ?? '?'} waypoints</span>
      <span class="meta-item">🕐 ${formatDate(route.updatedAt)}</span>
      <span class="meta-item">${route.isPublic ? '🌐 Public' : '🔒 Hidden'}</span>
      ${catHtml ? `<div style="display:flex;gap:4px;flex-wrap:wrap;width:100%;margin-top:2px;">${catHtml}</div>` : ''}
    `;

    // Preview only
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

    // Fav button in detail
    const isFav = _myFavorites.has(route.id);
    const favBtn = document.getElementById('btnDetailFav');
    if (favBtn) {
      favBtn.className = `btn-fav${isFav ? ' faved' : ''}`;
      favBtn.title = isFav ? 'Remove from Favourites' : 'Add to Favourites';
      favBtn.textContent = isFav ? '⭐ Favourited' : '☆ Favourite';
      favBtn.style.display = uid ? 'inline-flex' : 'none';
    }

    // Rating widget
    const ratingWrap = document.getElementById('detailRatingWrap');
    if (ratingWrap && uid) {
      // Load my rating
      if (window.FirestoreRoutes?.getMyRating) {
        _myRating = await window.FirestoreRoutes.getMyRating(route.id, uid);
      }
      ratingWrap.innerHTML = renderInteractiveBeansHtml(_myRating);
      ratingWrap.style.display = 'flex';
      // Wire bean clicks
      ratingWrap.querySelectorAll('.bean[data-val]').forEach(b => {
        b.addEventListener('mouseenter', () => {
          const v = parseInt(b.dataset.val);
          ratingWrap.querySelectorAll('.bean').forEach((bb, i) => bb.classList.toggle('filled', i < v));
        });
        b.addEventListener('mouseleave', () => {
          ratingWrap.querySelectorAll('.bean').forEach((bb, i) => bb.classList.toggle('filled', _myRating && i < _myRating));
        });
        b.addEventListener('click', () => submitRating(route.id, parseInt(b.dataset.val)));
      });
    } else if (ratingWrap) {
      // Show aggregate rating only
      ratingWrap.innerHTML = renderBeansHtml(route.avgRating || 0, route.ratingCount || 0);
      ratingWrap.style.display = 'flex';
    }

    routeDetail.style.display = 'block';
  }

  async function submitRating(routeId, val) {
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid) { showToast('Sign in to rate'); return; }
    try {
      await window.FirestoreRoutes.rateRoute(routeId, val, uid);
      _myRating = val;
      showToast(`Rated ${val} bean${val>1?'s':''}! 🫘`);
      // Refresh route in list
      await loadRoutes();
      const updated = _allRoutes.find(r => r.id === routeId);
      if (updated) selectRoute(updated);
    } catch (err) {
      showToast('Rating error: ' + err.message);
    }
  }

  /* ── Toggle favorite ── */
  async function toggleFav(routeId) {
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid) { showToast('Sign in to favourite'); return; }
    try {
      const nowFaved = await window.FirestoreRoutes.toggleFavorite(routeId, uid);
      if (nowFaved) _myFavorites.add(routeId); else _myFavorites.delete(routeId);
      showToast(nowFaved ? '⭐ Added to Favourites' : 'Removed from Favourites');
      // Update row fav button
      const btn = tbody.querySelector(`.btn-fav[data-id="${routeId}"]`);
      if (btn) { btn.classList.toggle('faved', nowFaved); btn.title = nowFaved ? 'Unfavorite' : 'Favorite'; }
      // Update detail fav button if open
      const favBtn = document.getElementById('btnDetailFav');
      if (favBtn && _selectedId === routeId) {
        favBtn.className = `btn-fav${nowFaved ? ' faved' : ''}`;
        favBtn.textContent = nowFaved ? '⭐ Favourited' : '☆ Favourite';
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  function closeDetail() {
    routeDetail.style.display = 'none';
    _selectedId = null;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
  }

  /* ── Load route in editor ── */
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
    if (chkFavsOnly) chkFavsOnly.checked = false;
    _sortCol = 'updatedAt'; _sortDir = 'desc';
    _activeCatFilter = null;
    sortSelect.value = 'updatedAt';
    if (catFilterBar) catFilterBar.querySelectorAll('.cat-toggle').forEach(b => b.classList.remove('on'));
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

  // Detail fav button
  document.getElementById('btnDetailFav')?.addEventListener('click', () => {
    if (_selectedId) toggleFav(_selectedId);
  });

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
