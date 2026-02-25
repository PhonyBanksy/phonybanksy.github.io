/**
 * community.js
 * Community route browser.
 * Features: categories, bean ratings, favorites, download-gated voting,
 * total-bean display, admin multi-select delete, grouped-by-creator view.
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
  let _selectedIds     = new Set(); // admin multi-select

  // Group display mode: 'flat' | 'byCreator'
  let _groupMode = 'byCreator';

  // Expanded creator groups
  let _expandedCreators = new Set();

  // Safely load previously downloaded routes from local storage
  let _myDownloads = new Set();
  try {
    const stored = localStorage.getItem('mt_downloads');
    if (stored) _myDownloads = new Set(JSON.parse(stored));
  } catch(e) { console.warn('Could not parse local downloads', e); }

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


  /* ── Bean rank tiers (rank 1 = best) ── */
  // Bean rank tiers — all bean-themed, icons are SVG beans rendered via CSS classes
  const BEAN_RANKS = [
    { pos: 0,  label: 'Bean Baron',     beanClass: 'bean-rank-1',  color: '#FFD700', size: 28 },
    { pos: 1,  label: 'Bean Magnate',   beanClass: 'bean-rank-2',  color: '#E8E8E8', size: 24 },
    { pos: 2,  label: 'Bean Tycoon',    beanClass: 'bean-rank-3',  color: '#CD7F32', size: 22 },
    { pos: 3,  label: 'Bean Merchant',  beanClass: 'bean-rank-4',  color: '#8bc34a', size: 18 },
    { pos: 4,  label: 'Bean Trader',    beanClass: 'bean-rank-5',  color: '#4caf50', size: 17 },
    { pos: 5,  label: 'Bean Marketeer', beanClass: 'bean-rank-6',  color: '#26c6da', size: 16 },
    { pos: 6,  label: 'Bean Seller',    beanClass: 'bean-rank-7',  color: '#4fc3f7', size: 15 },
    { pos: 7,  label: 'Bean Grower',    beanClass: 'bean-rank-8',  color: '#9c6aff', size: 15 },
    { pos: 8,  label: 'Bean Picker',    beanClass: 'bean-rank-9',  color: '#f5a623', size: 14 },
    { pos: 9,  label: 'Bean Farmer',    beanClass: 'bean-rank-10', color: '#a07060', size: 14 },
  ];
  const ADMIN_RANK = { label: 'Bean Sprout', beanClass: 'bean-rank-admin', color: '#27c26b', size: 16 };

  // Returns SVG bean icon HTML with size/color for rank
  function beanSvg(rank) {
    const s = rank.size || 16;
    const col = rank.color;
    // Bean shape: simple oval with highlight and shadow for depth
    const shadow = col + '55';
    const highlight = 'rgba(255,255,255,0.35)';
    return `<svg class="bean-svg ${rank.beanClass||''}" width="${s}" height="${s}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;" title="${rank.label}">
      <ellipse cx="12" cy="13" rx="8" ry="9" fill="${col}"/>
      <ellipse cx="12" cy="12.5" rx="7.5" ry="8.5" fill="${col}"/>
      <path d="M8 7 Q12 4 16 7 Q18 10 16 14 Q14 17 12 16 Q9 15 8 12 Q7 9 8 7Z" fill="${shadow}" opacity="0.4"/>
      <ellipse cx="10" cy="9" rx="2.5" ry="3.5" fill="${highlight}" transform="rotate(-20 10 9)"/>
      <path d="M12 5 Q14 7 14 10 Q14 13 12 14" stroke="rgba(0,0,0,0.2)" stroke-width="1" fill="none"/>
    </svg>`;
  }

  /* ── Category config ── */
  const CATS = ['Sprint','Circuit','Endurance','Offroad','Dakar','Hills','Technical','Speed'];
  const CAT_CLASSES = {
    Sprint:'tag-sprint', Circuit:'tag-circuit', Endurance:'tag-endurance',
    Offroad:'tag-offroad', Dakar:'tag-dakar', Hills:'tag-hills',
    Technical:'tag-technical', Speed:'tag-speed'
  };

  /* ── Category filter bar ── */
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

  /* ── Inject admin multi-select toolbar into browser-toolbar ── */
  const toolbar = document.getElementById('browser-toolbar');
  if (toolbar) {
    // Group mode toggle
    const groupToggle = document.createElement('button');
    groupToggle.id = 'btnGroupMode';
    groupToggle.className = 'btn-ghost btn-sm';
    groupToggle.textContent = '👤 By Creator';
    groupToggle.title = 'Toggle grouping';
    groupToggle.addEventListener('click', () => {
      _groupMode = _groupMode === 'byCreator' ? 'flat' : 'byCreator';
      groupToggle.textContent = _groupMode === 'byCreator' ? '📋 Flat List' : '👤 By Creator';
      renderTable();
    });
    toolbar.appendChild(groupToggle);

    // Admin bulk-delete bar (hidden until selections made)
    const bulkBar = document.createElement('div');
    bulkBar.id = 'bulkBar';
    bulkBar.style.cssText = 'display:none;align-items:center;gap:6px;margin-left:auto;';
    bulkBar.innerHTML = `
      <span id="bulkCount" style="font-family:var(--mono);font-size:10px;color:var(--muted);"></span>
      <button id="btnBulkDelete" class="btn-danger btn-sm">🗑 Delete Selected</button>
      <button id="btnBulkClear" class="btn-ghost btn-sm">✕ Clear</button>
    `;
    toolbar.appendChild(bulkBar);

    document.getElementById('btnBulkDelete')?.addEventListener('click', bulkDelete);
    document.getElementById('btnBulkClear')?.addEventListener('click', () => {
      _selectedIds.clear();
      updateBulkBar();
      renderTable();
    });
  }

  function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    const countEl = document.getElementById('bulkCount');
    if (!bar) return;
    const isAdmin = window.AuthUI?.isAdmin();
    if (_selectedIds.size > 0 && isAdmin) {
      bar.style.display = 'flex';
      if (countEl) countEl.textContent = `${_selectedIds.size} selected`;
    } else {
      bar.style.display = 'none';
    }
  }

  async function bulkDelete() {
    if (!_selectedIds.size) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid || !window.AuthUI?.isAdmin()) { showToast('Admin only'); return; }
    if (!confirm(`Permanently delete ${_selectedIds.size} route(s)? Cannot be undone.`)) return;

    const ids = [..._selectedIds];
    let failed = 0;
    for (const id of ids) {
      try {
        await window.FirestoreRoutes.deleteRoute(id, uid);
      } catch (err) {
        console.error('Delete failed for', id, err);
        failed++;
      }
    }
    _selectedIds.clear();
    updateBulkBar();
    if (failed) showToast(`Done — ${failed} failed`);
    else showToast(`Deleted ${ids.length} route(s)`);
    closeDetail();
    await loadRoutes();
  }

  /* ── Load routes ── */
  async function loadRoutes(showAll = false) {
    routeCount.textContent = 'Loading…';
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading…</td></tr>';
    try {
      if (showAll && window.AuthUI?.isAdmin()) {
        _allRoutes = await window.FirestoreRoutes.getAllRoutes();
      } else {
        _allRoutes = await window.FirestoreRoutes.getPublicRoutes({ limitCount: 300 });
      }
      const uid = window.AuthUI?.getCurrentUser()?.uid;
      if (uid && window.FirestoreRoutes?.getMyFavorites) {
        const favIds = await window.FirestoreRoutes.getMyFavorites(uid);
        _myFavorites = new Set(favIds);
      }
      applyFilters();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty" style="color:#d95050;">Error: ${escHtml(err.message)}</td></tr>`;
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
    const isAdmin = window.AuthUI?.isAdmin();

    if (!_filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No routes found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    buildRankCache();

    if (_groupMode === 'byCreator') {
      renderGroupedByCreator(isAdmin);
    } else {
      renderFlat(isAdmin);
    }
  }

  function renderGroupedByCreator(isAdmin) {
    // Group routes by ownerUid
    const groups = new Map(); // ownerUid → { inGameName, routes[] }
    _filtered.forEach(route => {
      const key = route.ownerUid || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, { inGameName: route.inGameName || 'Unknown', routes: [] });
      }
      groups.get(key).routes.push(route);
    });

    groups.forEach((group, ownerUid) => {
      const isExpanded = _expandedCreators.has(ownerUid);
      const routes = group.routes;

      // Creator header row
      const headerTr = document.createElement('tr');
      headerTr.className = 'creator-group-header';
      headerTr.innerHTML = `
        <td colspan="${isAdmin ? 7 : 6}" class="creator-group-cell">
          <button class="creator-group-toggle" data-uid="${escHtml(ownerUid)}">
            <span class="creator-chevron">${isExpanded ? '▾' : '▸'}</span>
            <span class="creator-avatar">👤</span>
            <span class="creator-name">${escHtml(group.inGameName)}</span>
            <span class="creator-route-count">${routes.length} route${routes.length !== 1 ? 's' : ''}</span>
          </button>
        </td>
      `;
      headerTr.querySelector('.creator-group-toggle').addEventListener('click', () => {
        if (_expandedCreators.has(ownerUid)) {
          _expandedCreators.delete(ownerUid);
        } else {
          _expandedCreators.add(ownerUid);
        }
        renderTable();
      });
      tbody.appendChild(headerTr);

      if (isExpanded) {
        routes.forEach(route => {
          tbody.appendChild(buildRouteRow(route, isAdmin, true));
        });
      }
    });
  }

  function renderFlat(isAdmin) {
    _filtered.forEach(route => {
      tbody.appendChild(buildRouteRow(route, isAdmin, false));
    });
  }

  // Cached rank map: inGameName → { rank, totalBeans }
  let _rankCache = {};

  function buildRankCache() {
    const totals = {};
    _allRoutes.forEach(r => {
      const key = r.inGameName || '';
      if (!key) return;
      totals[key] = (totals[key] || 0) + (Number(r.totalBeans) || 0);
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    _rankCache = {};
    sorted.forEach(([name, beans], i) => {
      _rankCache[name] = { rank: BEAN_RANKS[Math.min(i, BEAN_RANKS.length - 1)], totalBeans: beans, pos: i };
    });
  }

  function getAuthorRank(inGameName) {
    return _rankCache[inGameName] || null;
  }

  function buildRouteRow(route, isAdmin, isChild) {
    const tr = document.createElement('tr');
    tr.dataset.id = route.id;
    if (route.id === _selectedId) tr.classList.add('selected');
    if (!route.isPublic) tr.classList.add('row-hidden');
    if (isChild) tr.classList.add('creator-child-row');

    const cats = (route.categories || []).slice(0, 3);
    const catHtml = cats.map(cat =>
      `<span class="route-tag ${CAT_CLASSES[cat]||''}">${escHtml(cat)}</span>`
    ).join('');

    const isFav = _myFavorites.has(route.id);
    const beansHtml = renderBeansCompact(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);
    const isChecked = _selectedIds.has(route.id);
    const dlCount = route.downloadCount || 0;

    // Author rank
    const rankInfo = getAuthorRank(route.inGameName);
    const rankBeanHtml = rankInfo
      ? `<span class="author-rank-bean" title="${rankInfo.rank.label} · 🫘 ${rankInfo.totalBeans} total beans">${beanSvg(rankInfo.rank)}</span>`
      : '';
    const rankLabelHtml = rankInfo
      ? `<span class="author-rank-label" style="color:${rankInfo.rank.color};">${rankInfo.rank.label}</span>`
      : '';

    // Checkbox cell — always rendered but hidden for non-admins via CSS
    const checkboxCell = `<td class="col-check${isAdmin ? '' : ' col-check-hidden'}"><input type="checkbox" class="route-select-chk" data-id="${route.id}" ${isChecked ? 'checked' : ''} /></td>`;

    tr.innerHTML = `
      ${checkboxCell}
      <td class="col-name">
        <div class="col-name-main">
          ${isChild ? '<span class="child-indent">↳</span>' : ''}
          <span class="route-name-text">
            ${escHtml(route.routeName || 'Unnamed')}
            ${!route.isPublic ? '<span class="badge-hidden">Hidden</span>' : ''}
          </span>
        </div>
        ${route.description ? `<div class="route-desc-line">${escHtml(route.description)}</div>` : ''}
        ${catHtml ? `<div class="route-tags-line">${catHtml}</div>` : ''}
      </td>
      <td class="col-author">
        <div class="author-name-row">
          <span class="author-name-text">${escHtml(route.inGameName || '—')}</span>
          ${rankBeanHtml}
        </div>
        ${rankLabelHtml}
      </td>
      <td class="col-wps">${route.waypointCount ?? '?'}</td>
      <td class="col-dl">${dlCount > 0 ? `<span class="dl-count">⬇ ${dlCount}</span>` : '<span class="dl-zero">—</span>'}</td>
      <td class="col-rating">${beansHtml}</td>
      <td class="col-date">${formatDate(route.updatedAt)}</td>
      <td class="col-actions">
        <button class="btn-fav ${isFav?'faved':''}" data-id="${route.id}" title="${isFav?'Unfavorite':'Favorite'}">⭐</button>
        <button class="btn-load-inline" data-id="${route.id}" title="Load in Editor">⬇</button>
      </td>
    `;

    if (isAdmin) {
      tr.querySelector('.route-select-chk').addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) _selectedIds.add(route.id);
        else _selectedIds.delete(route.id);
        updateBulkBar();
      });
    }

    tr.querySelector('.btn-fav').addEventListener('click', e => { e.stopPropagation(); toggleFav(route.id); });
    tr.querySelector('.btn-load-inline').addEventListener('click', e => { e.stopPropagation(); loadRouteInEditor(route); });
    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('route-select-chk')) return;
      selectRoute(route);
    });

    return tr;
  }

  /* ── Bean display helpers ── */

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

  function renderBeansDetail(avg, count, totalBeans) {
    const full = Math.round(avg);
    let html = '<div class="beans-detail-wrap" style="align-items: flex-end;">';
    html += '<div class="beans-row">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${i <= full ? 'filled' : ''}">🫘</span>`;
    }
    html += `<span class="bean-count">${count > 0 ? avg.toFixed(1) + ' avg' : 'No ratings yet'}</span>`;
    html += '</div>';
    if (count > 0 && totalBeans > 0) {
      html += `<div class="beans-total" style="justify-content: flex-end;">`;
      html += `<span class="beans-total-label">🫘 × ${totalBeans} total beans</span>`;
      html += `<span class="beans-total-sub">${count} vote${count!==1?'s':''}</span>`;
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

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
    html += `<div class="bean-rating-hint">${myRating ? `Your rating: ${myRating} 🫘` : 'How many beans does it deserve?'}</div>`;
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

    // Show creator ID for traceability
    const creatorId = route.ownerUid ? `<span class="meta-item" title="Creator UID: ${escHtml(route.ownerUid)}" style="font-family:var(--mono);font-size:9px;color:var(--muted);">🆔 ${escHtml(route.ownerUid.slice(0,12))}…</span>` : '';

    detailMeta.innerHTML = `
      <span class="meta-item">👤 ${escHtml(route.inGameName || 'Unknown')}</span>
      <span class="meta-item">📍 ${route.waypointCount ?? '?'} waypoints</span>
      <span class="meta-item">🕐 ${formatDate(route.updatedAt)}</span>
      <span class="meta-item">${route.isPublic ? '🌐 Public' : '🔒 Hidden'}</span>
      ${creatorId}
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

    // Admin edit button
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
      favBtn.title       = isFav ? 'Remove from Favourites' : 'Add to Favourites';
      favBtn.textContent = isFav ? '⭐ Favourited' : '☆ Favourite';
      favBtn.style.display = uid ? 'inline-flex' : 'none';
    }

    // Rating section
    const ratingWrap = document.getElementById('detailRatingWrap');
    if (ratingWrap) {
      if (uid && !isOwner) {
        let html = renderBeansDetail(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);
        html += '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;text-align:right;width:100%;">';
        html += '<div style="font-size:10px;color:var(--muted);font-family:var(--head);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Your Rating</div>';
        html += '<div id="ratingWidgetSlot" style="min-height:28px;"></div>';
        html += '</div>';
        ratingWrap.innerHTML = html;
        ratingWrap.style.display = 'flex';

        const [myRatingResult, hasDownloadedResult] = await Promise.all([
          window.FirestoreRoutes?.getMyRating?.(route.id, uid).catch(() => null) ?? Promise.resolve(null),
          window.FirestoreRoutes?.hasDownloaded?.(route.id, uid).catch(() => false) ?? Promise.resolve(false)
        ]);

        _myRating = myRatingResult;
        const canRate = _myDownloads.has(route.id) || hasDownloadedResult;

        if (canRate) {
          _myDownloads.add(route.id);
          localStorage.setItem('mt_downloads', JSON.stringify([..._myDownloads]));
        }

        const canRateFinal = canRate || (_myRating !== null);

        const slot = ratingWrap.querySelector('#ratingWidgetSlot');
        if (slot) {
          slot.outerHTML = renderInteractiveBeans(_myRating, canRateFinal);
        }

        const interactiveWrap = ratingWrap.querySelector('.bean-interactive');
        if (interactiveWrap) {
          const btns = interactiveWrap.querySelectorAll('.bean-btn');
          btns.forEach((b, i) => {
            b.addEventListener('mouseenter', () => {
              btns.forEach((bb, j) => bb.classList.toggle('filled', j <= i));
            });
            b.addEventListener('click', () => submitRating(route.id, parseInt(b.dataset.val)));
          });
          interactiveWrap.addEventListener('mouseleave', () => {
            btns.forEach((bb, j) => bb.classList.toggle('filled', !!(_myRating && j + 1 <= _myRating)));
          });
        }
      } else {
        ratingWrap.innerHTML = renderBeansDetail(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);
        ratingWrap.style.display = 'flex';
      }
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
      await loadRoutes();
      const updated = _allRoutes.find(r => r.id === routeId);
      if (updated) selectRoute(updated);
    } catch (err) {
      showToast('Rating failed: ' + err.message);
    }
  }

  /* ── Admin edit modal ── */
  function openAdminEditModal() {
    if (!_selectedRoute) return;
    const route = _selectedRoute;

    const existingModal = document.getElementById('adminEditModal');
    if (existingModal) existingModal.remove();

    const cats = route.categories || [];
    const catToggles = CATS.map(c => {
      const on = cats.includes(c) ? 'on' : '';
      return `<button type="button" class="cat-toggle ${CAT_CLASSES[c]} ${on} aem-cat" data-cat="${c}">${c}</button>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'adminEditModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:460px;width:100%;">
        <h2 class="modal-title" style="margin-bottom:4px;">✏️ Edit Route</h2>
        <p class="modal-subtitle" style="margin-bottom:12px;color:var(--muted);font-size:11px;">Editing: ${escHtml(route.routeName)}</p>
        <div class="modal-field">
          <label>Route Name</label>
          <input id="aemRouteName" type="text" maxlength="128" value="${escHtml(route.routeName||'')}" />
        </div>
        <div class="modal-field" style="margin-top:10px;">
          <label>Author (In-Game Name)</label>
          <input id="aemInGameName" type="text" maxlength="64" value="${escHtml(route.inGameName||'')}" />
        </div>
        <div class="modal-field" style="margin-top:10px;">
          <label>Description <span style="font-weight:400;color:var(--muted);">(280 chars)</span></label>
          <textarea id="aemDescription" maxlength="280" rows="2" style="background:var(--input-bg,#252525);border:1px solid var(--border,#333);border-radius:3px;color:var(--fg,#e0e0e0);font-size:12px;padding:7px 10px;font-family:var(--body,'Barlow',sans-serif);outline:none;resize:vertical;min-height:48px;width:100%;transition:border-color .15s;">${escHtml(route.description||'')}</textarea>
        </div>
        <div class="modal-field" style="margin-top:10px;">
          <label>Visibility</label>
          <label class="check-wrap" style="margin-top:4px;">
            <input type="checkbox" id="aemIsPublic" ${route.isPublic?'checked':''} />
            <span>Public</span>
          </label>
        </div>
        <div class="modal-field" style="margin-top:10px;">
          <label>Categories</label>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${catToggles}</div>
        </div>
        <p id="aemError" style="color:#d95050;font-size:11px;min-height:14px;margin-top:8px;"></p>
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button id="aemSave" class="btn-primary" style="flex:1;">Save Changes</button>
          <button id="aemCancel" class="btn-ghost" style="flex:1;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.aem-cat').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('on'));
    });

    modal.querySelector('#aemCancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#aemSave').addEventListener('click', async () => {
      const routeName  = modal.querySelector('#aemRouteName').value.trim();
      const inGameName = modal.querySelector('#aemInGameName').value.trim();
      const isPublic   = modal.querySelector('#aemIsPublic').checked;
      const categories = [...modal.querySelectorAll('.aem-cat.on')].map(b => b.dataset.cat);
      const description = modal.querySelector('#aemDescription')?.value?.trim() || '';
      const errEl      = modal.querySelector('#aemError');

      if (!routeName) { errEl.textContent = 'Route name required.'; return; }
      const saveBtn = modal.querySelector('#aemSave');
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        const uid = window.AuthUI?.getCurrentUser()?.uid;
        const isAdmin = window.AuthUI?.isAdmin();
        if (isAdmin) {
          await window.FirestoreRoutes.adminUpdateRoute(route.id, { routeName, inGameName, isPublic, categories, description });
        } else {
          await window.FirestoreRoutes.saveRoute({
            routeName, isPublic, uid,
            inGameName: inGameName || route.inGameName,
            routeId: route.id,
            routeData: route.routeData,
            categories,
            description
          });
        }
        modal.remove();
        showToast('Route updated!');
        await loadRoutes();
        const updated = _allRoutes.find(r => r.id === route.id);
        if (updated) selectRoute(updated);
      } catch (err) {
        errEl.textContent = 'Error: ' + err.message;
        saveBtn.disabled = false; saveBtn.textContent = 'Save Changes';
      }
    });
  }

  function showAdminPromoModal() {
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    const instructions = window.FirestoreRoutes?.getAdminInstructions?.(uid) ||
      `Set role="admin" on your user doc in Firestore Console.\nYour UID: ${uid||'(not logged in)'}`;
    alert(instructions);
  }

  /* ── Fav ── */
  async function toggleFav(routeId) {
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid) { showToast('Sign in to favourite'); return; }
    try {
      const nowFaved = await window.FirestoreRoutes.toggleFavorite(routeId, uid);
      if (nowFaved) _myFavorites.add(routeId); else _myFavorites.delete(routeId);
      showToast(nowFaved ? '⭐ Added to Favourites' : 'Removed from Favourites');
      const rowBtn = tbody.querySelector(`.btn-fav[data-id="${routeId}"]`);
      if (rowBtn) { rowBtn.classList.toggle('faved', nowFaved); rowBtn.title = nowFaved ? 'Unfavorite' : 'Favorite'; }
      const favBtn = document.getElementById('btnDetailFav');
      if (favBtn && _selectedId === routeId) {
        favBtn.className   = `btn-fav${nowFaved?' faved':''}`;
        favBtn.textContent = nowFaved ? '⭐ Favourited' : '☆ Favourite';
      }
    } catch (err) { showToast('Error: ' + err.message); }
  }

  function closeDetail() {
    routeDetail.style.display = 'none';
    _selectedId = null; _selectedRoute = null;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
  }

  function loadRouteInEditor(route) {
    // Save the full JSON data to a temporary 'transfer' key
    localStorage.setItem('mt_transfer_json', JSON.stringify(route.routeData));

    // Track download for rating gating
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (uid && window.FirestoreRoutes?.recordDownload) {
      window.FirestoreRoutes.recordDownload(route.id, uid).catch(() => {});
    }

    _myDownloads.add(route.id);
    try {
      localStorage.setItem('mt_downloads', JSON.stringify([..._myDownloads]));
    } catch(e) {}

    window.location.href = 'index.html';
  }

  function copyRouteJson() {
    const route = _filtered.find(r => r.id === _selectedId);
    if (!route?.routeData) { showToast('No route selected'); return; }
    const text = JSON.stringify(route.routeData, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); ta.remove();
      showToast('Copied!');
    }
  }

  async function toggleVisibility() {
    const route = _filtered.find(r => r.id === _selectedId);
    if (!route) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    if (!uid) { showToast('Sign in first'); return; }
    btnToggleVis.disabled = true;
    try {
      await window.FirestoreRoutes.setRouteVisibility(route.id, !route.isPublic, uid);
      showToast(route.isPublic ? 'Route hidden' : 'Route is now public');
      closeDetail(); await loadRoutes();
    } catch (err) { showToast('Error: ' + err.message); }
    finally { btnToggleVis.disabled = false; }
  }

  async function adminDelete() {
    const route = _filtered.find(r => r.id === _selectedId) || _selectedRoute;
    if (!route) return;
    if (!confirm(`Delete "${route.routeName}" by ${route.inGameName}? Cannot be undone.`)) return;
    const uid = window.AuthUI?.getCurrentUser()?.uid;
    try {
      await window.FirestoreRoutes.deleteRoute(route.id, uid);
      showToast('Deleted'); closeDetail(); await loadRoutes();
    } catch (err) { showToast('Error: ' + err.message); }
  }


  /* ── LEADERBOARD ── */

  function getBeanRankForPosition(pos, isAdminUser) {
    if (isAdminUser) return ADMIN_RANK;
    return BEAN_RANKS[Math.min(pos, BEAN_RANKS.length - 1)] || BEAN_RANKS[BEAN_RANKS.length - 1];
  }

  function renderBeanRankBadge(rank) {
    return `<span class="bean-rank-badge" style="color:${rank.color};border-color:${rank.color}20;background:${rank.color}15;" title="${rank.label}">${beanSvg(rank)} ${rank.label}</span>`;
  }

  async function openLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    const list  = document.getElementById('lb-list');
    if (!modal || !list) return;
    modal.style.display = 'flex';
    list.innerHTML = '<div class="lb-loading">Loading…</div>';

    try {
      const board = await window.FirestoreRoutes.getLeaderboard();
      if (!board.length) {
        list.innerHTML = '<div class="lb-loading">No bean data yet — start rating routes!</div>';
        return;
      }
      list.innerHTML = '';
      board.forEach((entry, i) => {
        const rank = BEAN_RANKS[i] || BEAN_RANKS[BEAN_RANKS.length - 1];
        const isTop3 = i < 3;
        const row = document.createElement('div');
        row.className = 'lb-row' + (isTop3 ? ' lb-top3' : '');
        row.innerHTML = `
          <span class="lb-pos">${beanSvg(rank)}</span>
          <span class="lb-name">${escHtml(entry.inGameName)}</span>
          <span class="lb-rank-label" style="color:${rank.color};">${rank.label}</span>
          <span class="lb-beans">🫘 ${entry.totalBeans}</span>
          <span class="lb-routes">${entry.routeCount} route${entry.routeCount !== 1 ? 's' : ''}</span>
        `;
        list.appendChild(row);
      });
    } catch (err) {
      list.innerHTML = `<div class="lb-loading" style="color:#d95050;">Error: ${escHtml(err.message)}</div>`;
    }
  }

  // Wire leaderboard button
  document.getElementById('btnLeaderboard')?.addEventListener('click', openLeaderboard);
  document.getElementById('btnCloseLb')?.addEventListener('click', () => {
    const modal = document.getElementById('leaderboardModal');
    if (modal) modal.style.display = 'none';
  });
  document.getElementById('leaderboardModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('leaderboardModal')) {
      e.target.style.display = 'none';
    }
  });

  /* ── Sort ── */
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      _sortDir = (_sortCol === col && _sortDir === 'asc') ? 'desc' : 'asc';
      if (_sortCol !== col) { _sortCol = col; _sortDir = col === 'updatedAt' ? 'desc' : 'asc'; }
      sortSelect.value = _sortCol;
      updateSortArrows(); sortRoutes(); renderTable();
    });
  });

  function updateSortArrows() {
    document.querySelectorAll('th.sortable').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (!arrow) return;
      if (th.dataset.col === _sortCol) {
        arrow.textContent = _sortDir === 'asc' ? '▲' : '▼';
        th.classList.add('sort-active');
      } else { arrow.textContent = ''; th.classList.remove('sort-active'); }
    });
  }

  /* ── Wire buttons ── */
  btnApply.addEventListener('click', applyFilters);
  btnReset.addEventListener('click', () => {
    searchInput.value = ''; authorInput.value = '';
    chkMyRoutes.checked = false;
    if (chkFavsOnly) chkFavsOnly.checked = false;
    _sortCol = 'updatedAt'; _sortDir = 'desc'; _activeCatFilter = null;
    sortSelect.value = 'updatedAt';
    if (catFilterBar) catFilterBar.querySelectorAll('.cat-toggle').forEach(b => b.classList.remove('on'));
    updateSortArrows(); applyFilters();
  });
  btnRefresh.addEventListener('click',   () => loadRoutes());
  btnLoadRoute.addEventListener('click', () => { if (_selectedRoute) loadRouteInEditor(_selectedRoute); });
  btnCopyRoute.addEventListener('click', copyRouteJson);
  btnToggleVis.addEventListener('click', toggleVisibility);
  btnAdminDelete.addEventListener('click', adminDelete);
  btnCloseDetail.addEventListener('click', closeDetail);
  btnShowAll?.addEventListener('click', () => loadRoutes(true));
  document.getElementById('btnDetailFav')?.addEventListener('click', () => { if (_selectedId) toggleFav(_selectedId); });

  const btnPromote = document.getElementById('btnAdminPromote');
  if (btnPromote) btnPromote.addEventListener('click', showAdminPromoModal);

  [searchInput, authorInput].forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); })
  );
  sortSelect.addEventListener('change', () => {
    _sortCol = sortSelect.value; updateSortArrows(); sortRoutes(); renderTable();
  });

  document.addEventListener('authStateChanged', async () => {
    const isAdmin = window.AuthUI?.isAdmin();
    adminPanel.style.display = isAdmin ? 'block' : 'none';
    // Toggle is-admin class on table for checkbox column visibility
    const tbl = document.getElementById('route-table');
    if (tbl) tbl.classList.toggle('is-admin', !!isAdmin);
    loadRoutes();
  });

  /* ── Helpers ── */
  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  updateSortArrows();
  loadRoutes();
});
