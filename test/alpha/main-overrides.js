/**
 * main-overrides.js
 * - Hierarchical route tree with rename, collapse, delete
 * - Tooltip showing full name on hover
 * - Active highlighting + blink on save
 * - Intercepts saveRouteToLocalStorage to use grouped storage
 * - When logged in: also syncs to Firestore via FirestoreRoutes
 * - Wires Import/Export/Copy/Clear buttons
 * - Wires Inspector "Save Changes" button
 * - Wires auth UI: save/delete/visibility buttons update based on login state
 */

(function () {
  'use strict';

  let _activeRef = null;   // { gi, vi }
  let _activeEl  = null;   // highlighted DOM element

  // Maps localStorage group index to Firestore doc ID (when logged in)
  // Structure: { 'gi:vi': firestoreDocId }
  const _firestoreIds = {};

  /* ── STORAGE ── */

  function loadGroups() {
    try {
      const raw = localStorage.getItem('routeGroups');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    try {
      const old = JSON.parse(localStorage.getItem('routes') || '[]');
      if (old.length) {
        const groups = old.map(r => ({
          baseName: r.routeName || 'Route',
          baseData: r.routeData,
          variants: [],
          _collapsed: false
        }));
        saveGroups(groups);
        return groups;
      }
    } catch (_) {}
    return [];
  }

  function saveGroups(groups) {
    localStorage.setItem('routeGroups', JSON.stringify(groups));
  }

  /* ── TOAST ── */

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg || 'Done';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ── CLIPBOARD ── */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied!'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Copied!'); }
    catch (_) { showToast('Copy failed'); }
    ta.remove();
  }

  /* ── BLINK SIDEBAR ITEM ── */

  function blinkActive() {
    if (!_activeEl) return;
    _activeEl.classList.remove('sidebar-blink');
    void _activeEl.offsetWidth;
    _activeEl.classList.add('sidebar-blink');
    setTimeout(() => _activeEl && _activeEl.classList.remove('sidebar-blink'), 600);
  }

  /* ── TREE RENDER ── */

  function renderTree() {
    const tree  = document.getElementById('route-tree');
    const empty = document.getElementById('route-empty');
    if (!tree) return;

    tree.querySelectorAll('.route-group').forEach(el => el.remove());
    const groups = loadGroups();

    if (!groups.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    groups.forEach((group, gi) => tree.appendChild(buildGroupEl(group, gi, groups)));

    if (_activeRef) {
      const { gi, vi } = _activeRef;
      const groupEl = tree.querySelectorAll('.route-group')[gi];
      if (groupEl) {
        if (vi === -1) {
          const parent = groupEl.querySelector('.route-parent');
          if (parent) { parent.classList.add('active'); _activeEl = parent; }
        } else {
          const child = groupEl.querySelectorAll('.route-child')[vi];
          if (child) { child.classList.add('active'); _activeEl = child; }
        }
      }
    }
  }

  function buildGroupEl(group, gi, groups) {
    const wrap = document.createElement('div');
    wrap.className = 'route-group';

    const hasVariants = group.variants && group.variants.length > 0;
    const collapsed   = group._collapsed || false;

    /* ── PARENT ROW ── */
    const parent = document.createElement('div');
    parent.className = 'route-parent';
    parent.title = group.baseName;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'route-parent-load';
    loadBtn.innerHTML = `<span class="route-icon">🗺</span><span class="route-parent-name">${escHtml(group.baseName)}</span>`;
    loadBtn.title   = group.baseName;
    loadBtn.onclick = () => { setActiveEl(parent, gi, -1); loadIntoEditor(group.baseData); };
    parent.appendChild(loadBtn);

    const renBtn = document.createElement('button');
    renBtn.className   = 'route-rename-btn';
    renBtn.title       = 'Rename';
    renBtn.textContent = '✎';
    renBtn.onclick = () => startRename(loadBtn, group.baseName, (newName) => {
      group.baseName = newName;
      saveGroups(groups);
      renderTree();
      showToast('Renamed!');
    });
    parent.appendChild(renBtn);

    if (hasVariants) {
      const colBtn = document.createElement('button');
      colBtn.className   = 'route-collapse-btn';
      colBtn.title       = collapsed ? 'Expand' : 'Collapse';
      colBtn.textContent = collapsed ? '▸' : '▾';
      colBtn.onclick     = () => {
        group._collapsed = !group._collapsed;
        saveGroups(groups);
        renderTree();
      };
      parent.appendChild(colBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className   = 'route-delete-btn';
    delBtn.title       = 'Delete route';
    delBtn.textContent = '×';
    delBtn.onclick     = () => {
      if (confirm(`Delete "${group.baseName}" and all variants?`)) {
        // Also delete from Firestore if we have an ID stored
        const baseKey = `${gi}:-1`;
        if (_firestoreIds[baseKey] && window.AuthUI?.getCurrentUser()) {
          window.FirestoreRoutes?.deleteRoute(
            _firestoreIds[baseKey],
            window.AuthUI.getCurrentUser().uid
          ).catch(console.error);
          delete _firestoreIds[baseKey];
        }
        // Delete all variants from Firestore
        if (group.variants) {
          group.variants.forEach((_, vi) => {
            const varKey = `${gi}:${vi}`;
            if (_firestoreIds[varKey] && window.AuthUI?.getCurrentUser()) {
              window.FirestoreRoutes?.deleteRoute(
                _firestoreIds[varKey],
                window.AuthUI.getCurrentUser().uid
              ).catch(console.error);
              delete _firestoreIds[varKey];
            }
          });
        }
        groups.splice(gi, 1);
        saveGroups(groups);
        if (_activeRef && _activeRef.gi === gi) { _activeRef = null; _activeEl = null; }
        renderTree();
      }
    };
    parent.appendChild(delBtn);
    wrap.appendChild(parent);

    /* ── CHILDREN ── */
    if (hasVariants) {
      const childList = document.createElement('div');
      childList.className = 'route-children' + (collapsed ? ' collapsed' : '');

      group.variants.forEach((v, vi) => {
        const child = document.createElement('div');
        child.className = 'route-child';
        child.title     = v.label;

        const childLoad = document.createElement('button');
        childLoad.className = 'route-child-load';
        childLoad.innerHTML = `<span style="color:var(--accent);font-size:10px;">↳</span><span class="child-label">${escHtml(v.label)}</span>`;
        childLoad.title   = v.label;
        childLoad.onclick = () => { setActiveEl(child, gi, vi); loadIntoEditor(v.routeData); };

        const childRen = document.createElement('button');
        childRen.className   = 'route-child-rename';
        childRen.title       = 'Rename';
        childRen.textContent = '✎';
        childRen.onclick = (e) => {
          e.stopPropagation();
          startRenameChild(childLoad, v.label, (newName) => {
            v.label = newName;
            saveGroups(groups);
            renderTree();
            showToast('Renamed!');
          });
        };

        const childDel = document.createElement('button');
        childDel.className   = 'route-child-delete';
        childDel.title       = 'Delete variant';
        childDel.textContent = '×';
        childDel.onclick = (e) => {
          e.stopPropagation();
          const varKey = `${gi}:${vi}`;
          if (_firestoreIds[varKey] && window.AuthUI?.getCurrentUser()) {
            window.FirestoreRoutes?.deleteRoute(
              _firestoreIds[varKey],
              window.AuthUI.getCurrentUser().uid
            ).catch(console.error);
            delete _firestoreIds[varKey];
          }
          group.variants.splice(vi, 1);
          saveGroups(groups);
          if (_activeRef && _activeRef.gi === gi && _activeRef.vi === vi) {
            _activeRef = null; _activeEl = null;
          }
          renderTree();
        };

        // Cloud sync indicator badge
        const varKey = `${gi}:${vi}`;
        if (_firestoreIds[varKey]) {
          const badge = document.createElement('span');
          badge.className   = 'cloud-badge';
          badge.title       = 'Saved to cloud';
          badge.textContent = '☁';
          child.appendChild(badge);
        }

        child.appendChild(childLoad);
        child.appendChild(childRen);
        child.appendChild(childDel);
        childList.appendChild(child);
      });

      wrap.appendChild(childList);
    }

    return wrap;
  }

  /* ── RENAME HELPERS ── */

  function startRename(loadBtn, currentName, onCommit) {
    const nameSpan = loadBtn.querySelector('.route-parent-name');
    if (!nameSpan) return;
    const input = document.createElement('input');
    input.type      = 'text';
    input.value     = currentName;
    input.className = 'route-rename-input';
    nameSpan.replaceWith(input);
    input.focus(); input.select();
    const commit = () => { onCommit(input.value.trim() || currentName); };
    input.onblur    = commit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); renderTree(); }
    };
  }

  function startRenameChild(loadBtn, currentLabel, onCommit) {
    const labelSpan = loadBtn.querySelector('.child-label');
    if (!labelSpan) return;
    const input = document.createElement('input');
    input.type      = 'text';
    input.value     = currentLabel;
    input.className = 'route-rename-input';
    input.style.fontSize = '10px';
    labelSpan.replaceWith(input);
    input.focus(); input.select();
    const commit = () => { onCommit(input.value.trim() || currentLabel); };
    input.onblur    = commit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); renderTree(); }
    };
  }

  function setActiveEl(el, gi, vi) {
    document.querySelectorAll('.route-parent, .route-child').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    _activeEl  = el;
    _activeRef = { gi, vi };
  }

  function loadIntoEditor(routeData) {
    const str = JSON.stringify(routeData, null, 2);
    const inputEl  = document.getElementById('json_data');
    const outputEl = document.getElementById('output');
    if (inputEl)  inputEl.value  = str;
    if (outputEl) outputEl.value = str;
    if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
    // Reflect route state in toolbar badges
    if (RouteProcessor.updateStateIndicators) {
      RouteProcessor.updateStateIndicators(routeData._routeState || null);
    }
    // Reflect categories
    if (window.reflectRouteCategories) window.reflectRouteCategories(routeData);
  }

  /* ── SAVE WAYPOINT EDITS BACK TO ACTIVE ROUTE SLOT ── */

  async function saveActiveRouteData() {
    if (!_activeRef) { showToast('No route selected'); return; }

    const outputEl = document.getElementById('output');
    const raw = outputEl ? outputEl.value.trim() : '';
    if (!raw) { showToast('No output to save'); return; }

    let routeData;
    try { routeData = JSON.parse(raw); }
    catch (_) { showToast('Invalid JSON in output'); return; }

    const groups = loadGroups();
    const { gi, vi } = _activeRef;
    if (!groups[gi]) { showToast('Route not found'); return; }

    if (vi === -1) {
      groups[gi].baseData = routeData;
    } else {
      if (!groups[gi].variants[vi]) { showToast('Variant not found'); return; }
      groups[gi].variants[vi].routeData = routeData;
    }

    saveGroups(groups);
    blinkActive();

    // Sync to Firestore if logged in
    const user    = window.AuthUI?.getCurrentUser();
    const userDoc = window.AuthUI?.getCurrentUserDoc();
    if (user && window.FirestoreRoutes) {
      const key        = `${gi}:${vi}`;
      const routeName  = vi === -1 ? groups[gi].baseName : groups[gi].variants[vi].label;
      const isPublicEl = document.getElementById('chkRoutePublic');
      const isPublic   = isPublicEl ? isPublicEl.checked : true;
      const categories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);

      try {
        const savedId = await window.FirestoreRoutes.saveRoute({
          routeName,
          routeData,
          isPublic,
          uid:        user.uid,
          inGameName: userDoc?.inGameName || '',
          routeId:    _firestoreIds[key] || null,
          categories
        });
        _firestoreIds[key] = savedId;
        showToast('Saved to cloud ☁');
      } catch (err) {
        showToast('Local save OK — cloud error: ' + err.message);
        console.error('Firestore save error:', err);
      }
    } else {
      showToast('Saved locally (sign in to sync to cloud)');
    }

    setTimeout(() => renderTree(), 50);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── INTERCEPT saveRouteToLocalStorage ── */

  const _origSave = RouteProcessor.saveRouteToLocalStorage.bind(RouteProcessor);

  RouteProcessor.saveRouteToLocalStorage = async function (routeName, routeData) {
    const groups  = loadGroups();
    const inputEl = document.getElementById('json_data');

    let baseName = 'Route';
    try {
      const inputData = JSON.parse(inputEl ? inputEl.value : '{}');
      baseName = inputData.routeName || routeData.routeName || 'Route';
    } catch (_) {
      baseName = routeData.routeName || 'Route';
    }

    const variantLabel  = routeName.trim();
    let group = groups.find(g => g.baseName === baseName);

    if (!group) {
      let baseData = routeData;
      try { baseData = JSON.parse(inputEl ? inputEl.value : '{}'); } catch (_) {}
      group = { baseName, baseData, variants: [], _collapsed: false };
      groups.push(group);
    }

    const gi            = groups.indexOf(group);
    const alreadyExists = group.variants.findIndex(v => v.label === variantLabel);
    let vi;

    if (alreadyExists === -1) {
      group.variants.push({ label: variantLabel, routeData });
      vi = group.variants.length - 1;
    } else {
      group.variants[alreadyExists].routeData = routeData;
      vi = alreadyExists;
    }

    saveGroups(groups);
    _origSave(routeName, routeData);
    renderTree();

    // Auto-sync to Firestore if logged in
    const user    = window.AuthUI?.getCurrentUser();
    const userDoc = window.AuthUI?.getCurrentUserDoc();
    if (user && window.FirestoreRoutes) {
      const key      = `${gi}:${vi}`;
      const isPublicEl = document.getElementById('chkRoutePublic');
      const isPublic   = isPublicEl ? isPublicEl.checked : true;
      const categories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);
      try {
        const savedId = await window.FirestoreRoutes.saveRoute({
          routeName: variantLabel,
          routeData,
          isPublic,
          uid:        user.uid,
          inGameName: userDoc?.inGameName || '',
          routeId:    _firestoreIds[key] || null,
          categories
        });
        _firestoreIds[key] = savedId;
      } catch (err) {
        console.warn('Firestore auto-sync failed:', err.message);
      }
    }

    setTimeout(() => {
      const tree    = document.getElementById('route-tree');
      if (!tree) return;
      const groupEl = tree.querySelectorAll('.route-group')[gi];
      if (!groupEl) return;
      const childEl = groupEl.querySelectorAll('.route-child')[vi];
      if (childEl) { setActiveEl(childEl, gi, vi); blinkActive(); }
    }, 50);

    RouteProcessor.triggerBlink('saveCacheBtn');
  };

  RouteProcessor.updateRouteList = function () { renderTree(); };

  /* ── WIRE BUTTONS ── */

  const saveWpBtn = document.getElementById('btnSaveWaypoint');
  if (saveWpBtn) saveWpBtn.onclick = saveActiveRouteData;

  document.getElementById('clearCacheBtn').onclick = () => {
    if (confirm('Delete ALL saved routes and variants from this browser?\n(Cloud routes are not deleted)')) {
      localStorage.removeItem('routeGroups');
      localStorage.removeItem('routes');
      _activeRef = null; _activeEl = null;
      renderTree();
    }
  };

  document.getElementById('copyOutputBtn').onclick = () => {
    copyText(document.getElementById('output')?.value || '');
  };

  document.getElementById('importFromWebBtn').onclick = async () => {
    try {
      const text    = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) throw new Error('Not JSON');
      document.getElementById('json_data').value = trimmed;
      document.getElementById('output').value    = trimmed;
      if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
      showToast('Route imported!');
    } catch (_) {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      const jsonTab = document.querySelector('[data-pane="pane-json"]');
      if (jsonTab) { jsonTab.classList.add('on'); document.getElementById('pane-json').classList.add('on'); }
      document.getElementById('json_data')?.focus();
      showToast('Paste your JSON in the Input box');
    }
  };

  document.getElementById('exportToWebBtn').onclick = () => {
    const text = document.getElementById('output')?.value.trim() || '';
    if (!text) { showToast('No output to export yet'); return; }
    copyText(text);
  };

  /* ── AUTH STATE CHANGES ── */

  document.addEventListener('authStateChanged', (e) => {
    const loggedIn = !!e.detail?.user;
    // Update the visibility checkbox row
    const visRow = document.getElementById('routeVisibilityRow');
    if (visRow) visRow.style.display = loggedIn ? 'flex' : 'none';
  });

  /* ── INITIAL RENDER ── */
  renderTree();

})();
