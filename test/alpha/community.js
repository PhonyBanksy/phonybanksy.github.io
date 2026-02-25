/**
 * community.js
 * Community route browser.
 * Features: categories, bean ratings, favorites, download-gated voting,
 *           total-bean display, admin tools (rename/delete/edit tags/self-promote)
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
  
btnLoadRoute.addEventListener('click', async () => {
    if (!_selectedRoute) return;

    // 1. Track download to unlock voting
    const user = window.AuthUI?.getCurrentUser();
    if (user) {
        await window.FirestoreRoutes.trackDownload(_selectedId, user.uid);
    }

    // 2. Load into the editor (RouteProcessor)
    const jsonStr = JSON.stringify(_selectedRoute, null, 2);
    document.getElementById('json_data').value = jsonStr;
    
    // 3. Trigger Processor and Switch Tab
    RouteProcessor.process(); 
    document.querySelector('.tab[data-pane="editor"]').click();
    
    // 4. Update Visualizer
    if (window.MapVisualizerInstance) {
        window.MapVisualizerInstance.loadRoute(_selectedRoute);
    }
});

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

  // Detail panel: avg stars + total bean pile
  function renderBeansDetail(avg, count, totalBeans) {
    const full = Math.round(avg);
    let html = '<div class="beans-detail-wrap">';
    // Row 1: avg rating
    html += '<div class="beans-row">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="bean ${i <= full ? 'filled' : ''}">🫘</span>`;
    }
    html += `<span class="bean-count">${count > 0 ? avg.toFixed(1) + ' avg' : 'No ratings yet'}</span>`;
    html += '</div>';
    // Row 2: total beans pile
    if (count > 0 && totalBeans > 0) {
      html += `<div class="beans-total">`;
      html += `<span class="beans-total-label">🫘 × ${totalBeans} total beans</span>`;
      html += `<span class="beans-total-sub">${count} vote${count!==1?'s':''}</span>`;
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

  // Interactive rating widget
  function renderInteractiveBeans(myRating, canRate) {
    if (!canRate) {
      return `<div class="bean-gate-msg">⬇ Load this route in the editor first to unlock rating</div>`;
    }
    let html = '<div class="bean-interactive-wrap">';
    html += `<div class="bean-interactive" id="myRatingBeans">`;
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
      favBtn.title       = isFav ? 'Remove from Favourites' : 'Add to Favourites';
      favBtn.textContent = isFav ? '⭐ Favourited' : '☆ Favourite';
      favBtn.style.display = uid ? 'inline-flex' : 'none';
    }

    // Rating section
    const ratingWrap = document.getElementById('detailRatingWrap');
    if (ratingWrap) {
      if (uid && !isOwner) {
        _myRating = await window.FirestoreRoutes?.getMyRating?.(route.id, uid) ?? null;
        const canRate = _myDownloads.has(route.id) || await window.FirestoreRoutes?.hasDownloaded?.(route.id, uid);
        if (canRate) _myDownloads.add(route.id);

        // Show aggregate + interactive rating
        let html = renderBeansDetail(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);
        html += '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">';
        html += '<div style="font-size:10px;color:var(--muted);font-family:var(--head);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Your Rating</div>';
        html += renderInteractiveBeans(_myRating, canRate);
        html += '</div>';
        ratingWrap.innerHTML = html;
        ratingWrap.style.display = 'flex';

        // Wire bean clicks
        ratingWrap.querySelectorAll('.bean-btn[data-val]').forEach(b => {
          b.addEventListener('mouseenter', () => {
            const v = parseInt(b.dataset.val);
            ratingWrap.querySelectorAll('.bean-btn').forEach((bb, i) => bb.classList.toggle('filled', i < v));
          });
          b.addEventListener('mouseleave', () => {
            ratingWrap.querySelectorAll('.bean-btn').forEach((bb, i) => bb.classList.toggle('filled', !!(_myRating && i < _myRating)));
          });
          b.addEventListener('click', () => submitRating(route.id, parseInt(b.dataset.val)));
        });
      } else if (uid && isOwner) {
        // Owner sees aggregate only
        ratingWrap.innerHTML = renderBeansDetail(route.avgRating||0, route.ratingCount||0, route.totalBeans||0);
        ratingWrap.style.display = 'flex';
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

    // Build modal HTML
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

    // Cat toggles in modal
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
      const errEl      = modal.querySelector('#aemError');

      if (!routeName) { errEl.textContent = 'Route name required.'; return; }
      const saveBtn = modal.querySelector('#aemSave');
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        const uid = window.AuthUI?.getCurrentUser()?.uid;
        const isAdmin = window.AuthUI?.isAdmin();
        if (isAdmin) {
          await window.FirestoreRoutes.adminUpdateRoute(route.id, { routeName, inGameName, isPublic, categories });
        } else {
          // Owner update via saveRoute
          await window.FirestoreRoutes.saveRoute({
            routeName, isPublic, uid,
            inGameName: inGameName || route.inGameName,
            routeId: route.id,
            routeData: route.routeData,
            categories
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

  /* ── Admin self-promote modal ── */
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

  /* ── Load route in editor — also records download ── */
  async function loadRouteInEditor(route) {
    if (!route?.routeData) { showToast('No route data'); return; }
    try {
      // Record download for rating gate
      const uid = window.AuthUI?.getCurrentUser()?.uid;
      if (uid && window.FirestoreRoutes?.recordDownload) {
        window.FirestoreRoutes.recordDownload(route.id, uid).catch(() => {});
        _myDownloads.add(route.id);
      }
      sessionStorage.setItem('communityRouteLoad', JSON.stringify(route.routeData));
      window.location.href = 'index.html';
    } catch (e) { showToast('Could not load: ' + e.message); }
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

  // Admin self-promote button (added to admin panel)
  const btnPromote = document.getElementById('btnAdminPromote');
  if (btnPromote) btnPromote.addEventListener('click', showAdminPromoModal);

  [searchInput, authorInput].forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); })
  );
  sortSelect.addEventListener('change', () => {
    _sortCol = sortSelect.value; updateSortArrows(); sortRoutes(); renderTable();
  });

  document.addEventListener('authStateChanged', async () => {
    adminPanel.style.display = window.AuthUI?.isAdmin() ? 'block' : 'none';
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
