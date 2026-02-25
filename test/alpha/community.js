/**
 * community.js
 * Community route browser.
 * Features: categories, bean ratings, favorites, download-gated voting,
 * total-bean display, admin tools (rename/delete/edit tags/self-promote)
 */

import { auth } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {

  window.AuthUI?.init();

  /* ── State ── */
  let _allRoutes       = [];
  let _filtered        = [];
  let _sortCol         = 'updatedAt';
  let _sortDir         = 'desc';
  let _selectedId      = null;
  let _selectedRoute   = null;
  let _myFavorites     = new Set();
  let _myRating        = null;
  let _activeCatFilter = null;
  let _myDownloads     = new Set(); // routeIds this user has downloaded

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

  /* ── Category config ── */
  const CATS = ['Sprint','Circuit','Endurance','Offroad','Dakar','Hills','Technical','Speed'];
  const CAT_CLASSES = {
    Sprint:'tag-sprint', Circuit:'tag-circuit', Endurance:'tag-endurance',
    Offroad:'tag-offroad', Dakar:'tag-dakar', Hills:'tag-hills',
    Technical:'tag-technical', Speed:'tag-speed'
  };

  /* ── Category filter bar — colored even when unselected ── */
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

  /* ── Load routes ── */
  async function loadRoutes(showAll = false) {
    routeCount.textContent = 'Loading…';
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading…</td></tr>';
    try {
      if (showAll && window.AuthUI?.isAdmin()) {
        _allRoutes = await window.FirestoreRoutes.getAllRoutes();
      } else {
        _allRoutes = await window.FirestoreRoutes.getPublicRoutes({ limitCount: 200 });
      }
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
      if (myOnly  && r.ownerUid !== uid)                              return false;
      if (favOnly && !_myFavorites.has(r.id))                        return false;
      if (search  && !r.routeName?.toLowerCase().includes(search))   return false;
      if (author  && !r.inGameName?.toLowerCase().includes(author))  return false;
      if (_activeCatFilter && !(r.categories||[]).includes(_activeCatFilter)) return false;
      return true;
    });
    sortRoutes();
    renderTable();
  }

  function sortRoutes() {
    _filtered.sort((a, b) => {
      let va = a[_sortCol], vb = b[_sortCol];
      if (va?.seconds) va = va.seconds;
      if (vb?.seconds) vb = vb.seconds;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = _sortDir === 'asc' ? Infinity : -Infinity;
      if (vb == null) vb = _sortDir === 'asc' ? Infinity : -Infinity;
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

      const cats = (route.categories || []).slice(0, 4);
      const catHtml = cats.map(c =>
        `<span class="route-tag ${CAT_CLASSES[c]||''}">${escHtml(c)}</span>`
      ).join('');

      const isFav = _myFavorites.has(route.id);
      const beansHtml = renderBeansCompact(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);

      tr.innerHTML = `
        <td class="col-name">
          <div class="col-name-inner">
            <span class="route-name-text">
              ${escHtml(route.routeName || 'Unnamed')}
              ${!route.isPublic ? '<span class="badge-hidden">Hidden</span>' : ''}
            </span>
            ${catHtml ? `<span class="col-name-tags">${catHtml}</span>` : ''}
          </div>
        </td>
        <td class="col-author">${escHtml(route.inGameName || '—')}</td>
        <td class="col-wps">${route.waypointCount ?? '?'}</td>
        <td class="col-rating">${beansHtml}</td>
        <td class="col-date">${formatDate(route.updatedAt)}</td>
        <td class="col-actions">
          <button class="btn-fav ${isFav?'faved':''}" data-id="${route.id}" title="${isFav?'Unfavorite':'Favorite'}">⭐</button>
          <button class="btn-secondary btn-sm btn-load-inline" data-id="${route.id}" title="Load in Editor">⬇</button>
        </td>
      `;

      tr.querySelector('.btn-fav').addEventListener('click', e => { e.stopPropagation(); toggleFav(route.id); });
      tr.querySelector('.btn-load-inline').addEventListener('click', e => { e.stopPropagation(); loadRouteInEditor(route); });
      tr.addEventListener('click', () => selectRoute(route));
      tbody.appendChild(tr);
    });
  }

  /* ── Bean display helpers ── */

  // Compact inline: filled beans + "3.4 avg" or "— " if no votes
  function renderBeansCompact(avg, count, totalBeans) {
    const full = Math.round(avg);
    let html = '<span class="bean-rating">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${i <= full ? 'filled' : ''}">🫘</span>`;
    }
    if (count > 0) {
      html += `<span class="bean-count">${avg.toFixed(1)}</span>`;
    } else {
      html += `<span class="bean-count">—</span>`;
    }
    html += '</span>';
    return html;
  }

  // Detail panel: avg stars + total bean pile (Aligned right now)
  function renderBeansDetail(avg, count, totalBeans) {
    const full = Math.round(avg);
    let html = '<div class="beans-detail-wrap" style="align-items: flex-end;">';
    // Row 1: avg rating
    html += '<div class="beans-row">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${i <= full ? 'filled' : ''}">🫘</span>`;
    }
    html += `<span class="bean-count">${count > 0 ? avg.toFixed(1) + ' avg' : 'No ratings yet'}</span>`;
    html += '</div>';
    // Row 2: total beans pile
    if (count > 0 && totalBeans > 0) {
      html += `<div class="beans-total" style="justify-content: flex-end;">`;
      html += `<span class="beans-total-label">🫘 × ${totalBeans} total beans</span>`;
      html += `<span class="beans-total-sub">${count} vote${count!==1?'s':''}</span>`;
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

  // Interactive rating widget (Aligned right now)
  function renderInteractiveBeans(myRating, canRate) {
    if (!canRate) {
      return `<div class="bean-gate-msg" style="text-align: right;">⬇ Load this route in the editor first to unlock rating</div>`;
    }
    let html = '<div class="bean-interactive-wrap" style="align-items: flex-end;">';
    html += `<div class="bean-interactive" id="myRatingBeans" style="justify-content: flex-end;">`;
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean bean-btn ${myRating && i <= myRating ? 'filled' : ''}" data-val="${i}" title="${i} bean${i>1?'s':''}">🫘</span>`;
    }
    html += '</div>';
    html += `<div class="bean-rating-hint">${myRating ? `Your rating: ${myRating} 🫘` : 'Click to rate'}</div>`;
    html += '</div>';
    return html;
  }

  /* ── Select row → detail panel ── */
  async function selectRoute(route) {
    _selectedId    = route.id;
    _selectedRoute = route;
    _myRating      = null;

    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-id="${route.id}"]`);
    if (row) row.classList.add('selected');

    detailName.textContent = route.routeName || 'Unnamed';

    const cats = route.categories || [];
    const catHtml = cats.map(c =>
      `<span class="route-tag ${CAT_CLASSES[c]||''}">${escHtml(c)}</span>`
    ).join('');

    detailMeta.innerHTML = `
      <span class="meta-item">👤 ${escHtml(route.inGameName || 'Unknown')}</span>
      <span class="meta-item">📍 ${route.waypointCount ?? '?'} waypoints</span>
      <span class="meta-item">🕐 ${formatDate(route.updatedAt)}</span>
      <span class="meta-item">${route.isPublic ? '🌐 Public' : '🔒 Hidden'}</span>
      ${catHtml ? `<div class="meta-tags">${catHtml}</div>` : ''}
    `;

    const preview = route.routeData ? {
      routeName: route.routeData.routeName,
      waypoints: `[ ${route.waypointCount} waypoints — use Load to get full data ]`
    } : { note: 'No preview available' };
    detailJson.textContent = JSON.stringify(preview, null, 2);

    const uid     = window.AuthUI?.getCurrentUser()?.uid;
    const isOwner = route.ownerUid === uid;
    const isAdmin = window.AuthUI?.isAdmin();

    btnToggleVis.style.display   = (isOwner || isAdmin) ? 'inline-flex' : 'none';
    btnAdminDelete.style.display = (isOwner || isAdmin) ? 'inline-flex' : 'none';
    btnToggleVis.textContent     = route.isPublic ? '🔒 Make Hidden' : '🌐 Make Public';

    // Admin edit button (injected if not already present)
    let btnAdminEdit = document.getElementById('btnAdminEdit');
    if (!btnAdminEdit) {
      btnAdminEdit = document.createElement('button');
      btnAdminEdit.id        = 'btnAdminEdit';
      btnAdminEdit.className = 'btn-secondary btn-sm';
      btnAdminEdit.textContent = '✏️ Edit';
      document.getElementById('detail-actions').appendChild(btnAdminEdit);
      btnAdminEdit.addEventListener('click', () => openAdminEditModal());
    }
    btnAdminEdit.style.display = (isOwner || isAdmin) ? 'inline-flex' : 'none';

    // Fav button
    const isFav  = _myFavorites.has(route.id);
    const favBtn = document.getElementById('btnDetailFav');
    if (favBtn) {
      favBtn.className   = `btn-fav${isFav ? ' faved' : ''}`;
      favBtn.title       = is