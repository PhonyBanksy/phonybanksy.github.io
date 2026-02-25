/**
 * main-overrides.js
 * - Cloud-only route storage via Firestore (no localStorage route cache)
 * - Hierarchical route tree with rename, collapse, delete
 * - Tooltip showing full name on hover
 * - Active highlighting + blink on save
 * - Intercepts saveRouteToLocalStorage to use Firestore directly
 * - Wires Import/Export/Copy/Clear buttons
 * - Wires Inspector "Save Changes" button
 * - Wires auth UI: save/delete/visibility buttons update based on login state
 */

(function () {
  'use strict';

  let _activeRef = null;   // { gi, vi }
  let _activeEl  = null;   // highlighted DOM element

  // In-memory route groups (loaded from Firestore or built locally for unsaved routes)
  // Structure: [{ baseName, baseData, firestoreId, ownerUid, variants: [{ label, routeData, firestoreId }] }]
  let _groups = [];

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

  /* ── LOAD MY ROUTES FROM FIRESTORE ── */

  async function loadMyCloudRoutes() {
    const user = window.AuthUI?.getCurrentUser();
    if (!user || !window.FirestoreRoutes) return;

    try {
      const routes = await window.FirestoreRoutes.getMyRoutes(user.uid);
      // Build groups: each Firestore doc is a top-level entry (variants live locally for now)
      // Merge with existing _groups to preserve local-only unsaved items
      const cloudIds = new Set(routes.map(r => r.id));

      // Remove cloud groups that no longer exist in Firestore
      _groups = _groups.filter(g => !g.firestoreId || cloudIds.has(g.firestoreId));

      routes.forEach(r => {
        const existing = _groups.find(g => g.firestoreId === r.id);
        if (existing) {
          // Update metadata
          existing.baseName = r.routeName || existing.baseName;
          existing.baseData = r.routeData || existing.baseData;
          existing.ownerUid = r.ownerUid;
        } else {
          _groups.push({
            baseName:    r.routeName || 'Route',
            baseData:    r.routeData,
            firestoreId: r.id,
            ownerUid:    r.ownerUid,
            variants:    [],
            _collapsed:  false
          });
        }
      });

      renderTree();
    } catch (err) {
      console.error('Failed to load cloud routes:', err);
      showToast('Could not load cloud routes');
    }
  }

  /* ── TREE RENDER ── */

  function renderTree() {
    const tree  = document.getElementById('route-tree');
    const empty = document.getElementById('route-empty');
    if (!tree) return;

    tree.querySelectorAll('.route-group').forEach(el => el.remove());

    if (!_groups.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    _groups.forEach((group, gi) => tree.appendChild(buildGroupEl(group, gi)));

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

  function buildGroupEl(group, gi) {
    const wrap = document.createElement('div');
    wrap.className = 'route-group';

    const hasVariants = group.variants && group.variants.length > 0;
    const collapsed   = group._collapsed || false;

    /* ── PARENT ROW ── */
    const parent = document.createElement('div');
    parent.className = 'route-parent';
    parent.title = group.baseName;

    // Cloud indicator
    const cloudMark = group.firestoreId
      ? `<span class="cloud-badge" title="Saved to cloud (${group.firestoreId.slice(0,8)}…)">☁</span>`
      : `<span class="cloud-badge" style="color:#d95050;" title="Not saved to cloud">⚠</span>`;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'route-parent-load';
    loadBtn.innerHTML = `<span class="route-icon">🗺</span><span class="route-parent-name">${escHtml(group.baseName)}</span>${cloudMark}`;
    loadBtn.title   = group.baseName;
    loadBtn.onclick = () => { setActiveEl(parent, gi, -1); loadIntoEditor(group.baseData); };
    parent.appendChild(loadBtn);

    const renBtn = document.createElement('button');
    renBtn.className   = 'route-rename-btn';
    renBtn.title       = 'Rename';
    renBtn.textContent = '✎';
    renBtn.onclick = () => startRename(loadBtn, group.baseName, async (newName) => {
      group.baseName = newName;
      // Update cloud if saved
      if (group.firestoreId && window.FirestoreRoutes && window.AuthUI?.isAdmin()) {
        try {
          await window.FirestoreRoutes.adminUpdateRoute(group.firestoreId, { routeName: newName });
        } catch (_) {}
      }
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
        renderTree();
      };
      parent.appendChild(colBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className   = 'route-delete-btn';
    delBtn.title       = 'Delete route';
    delBtn.textContent = '×';
    delBtn.onclick = async () => {
      if (!confirm(`Delete "${group.baseName}" and all variants?`)) return;
      const user = window.AuthUI?.getCurrentUser();
      if (group.firestoreId && user && window.FirestoreRoutes) {
        try {
          await window.FirestoreRoutes.deleteRoute(group.firestoreId, user.uid);
        } catch (err) {
          showToast('Cloud delete failed: ' + err.message);
          return;
        }
      }
      // Delete variants from cloud
      if (group.variants) {
        for (const v of group.variants) {
          if (v.firestoreId && user && window.FirestoreRoutes) {
            window.FirestoreRoutes.deleteRoute(v.firestoreId, user.uid).catch(console.error);
          }
        }
      }
      _groups.splice(gi, 1);
      if (_activeRef && _activeRef.gi === gi) { _activeRef = null; _activeEl = null; }
      renderTree();
      showToast('Deleted');
    };
    parent.appendChild(delBtn);
    wrap.appendChild(parent);

    /* ── CHILDREN (local variants) ── */
    if (hasVariants) {
      const childList = document.createElement('div');
      childList.className = 'route-children' + (collapsed ? ' collapsed' : '');

      group.variants.forEach((v, vi) => {
        const child = document.createElement('div');
        child.className = 'route-child';
        child.title     = v.label;

        const childCloud = v.firestoreId
          ? `<span class="cloud-badge" title="Saved to cloud">☁</span>`
          : '';

        const childLoad = document.createElement('button');
        childLoad.className = 'route-child-load';
        childLoad.innerHTML = `<span style="color:var(--accent);font-size:10px;">↳</span><span class="child-label">${escHtml(v.label)}</span>${childCloud}`;
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
            renderTree();
            showToast('Renamed!');
          });
        };

        const childDel = document.createElement('button');
        childDel.className   = 'route-child-delete';
        childDel.title       = 'Delete variant';
        childDel.textContent = '×';
        childDel.onclick = async (e) => {
          e.stopPropagation();
          const user = window.AuthUI?.getCurrentUser();
          if (v.firestoreId && user && window.FirestoreRoutes) {
            try {
              await window.FirestoreRoutes.deleteRoute(v.firestoreId, user.uid);
            } catch (err) {
              showToast('Cloud delete failed: ' + err.message);
              return;
            }
          }
          group.variants.splice(vi, 1);
          if (_activeRef && _activeRef.gi === gi && _activeRef.vi === vi) {
            _activeRef = null; _activeEl = null;
          }
          renderTree();
        };

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
    if (RouteProcessor.updateStateIndicators) {
      RouteProcessor.updateStateIndicators(routeData._routeState || null);
    }
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

    const { gi, vi } = _activeRef;
    if (!_groups[gi]) { showToast('Route not found'); return; }

    const group = _groups[gi];
    if (vi === -1) {
      group.baseData = routeData;
    } else {
      if (!group.variants[vi]) { showToast('Variant not found'); return; }
      group.variants[vi].routeData = routeData;
    }

    blinkActive();

    // Push to Firestore
    const user    = window.AuthUI?.getCurrentUser();
    const userDoc = window.AuthUI?.getCurrentUserDoc();
    if (!user || !window.FirestoreRoutes) {
      showToast('Sign in to save to cloud');
      return;
    }

    const routeName  = vi === -1 ? group.baseName : group.variants[vi].label;
    const existingId = vi === -1 ? group.firestoreId : group.variants[vi]?.firestoreId;
    const isPublicEl = document.getElementById('chkRoutePublic');
    const isPublic   = isPublicEl ? isPublicEl.checked : true;
    const categories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);
    const description = (document.getElementById('routeDescription')?.value || '').trim();

    try {
      const savedId = await window.FirestoreRoutes.saveRoute({
        routeName,
        routeData,
        isPublic,
        uid:        user.uid,
        inGameName: userDoc?.inGameName || '',
        routeId:    existingId || null,
        categories,
        description
      });

      if (vi === -1) {
        group.firestoreId = savedId;
        group.ownerUid    = user.uid;
      } else {
        group.variants[vi].firestoreId = savedId;
      }

      showToast('Saved to cloud ☁');
    } catch (err) {
      showToast('Cloud save failed: ' + err.message);
      console.error('Firestore save error:', err);
    }

    renderTree();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── INTERCEPT saveRouteToLocalStorage — now saves to cloud ── */

  RouteProcessor.saveRouteToLocalStorage = async function (routeName, routeData) {
    const inputEl = document.getElementById('json_data');

    let baseName = 'Route';
    try {
      const inputData = JSON.parse(inputEl ? inputEl.value : '{}');
      baseName = inputData.routeName || routeData.routeName || 'Route';
    } catch (_) {
      baseName = routeData.routeName || 'Route';
    }

    const variantLabel = routeName.trim();
    let group = _groups.find(g => g.baseName === baseName);

    if (!group) {
      let baseData = routeData;
      try { baseData = JSON.parse(inputEl ? inputEl.value : '{}'); } catch (_) {}
      group = { baseName, baseData, firestoreId: null, ownerUid: null, variants: [], _collapsed: false };
      _groups.push(group);
    }

    const gi = _groups.indexOf(group);
    const alreadyExists = group.variants.findIndex(v => v.label === variantLabel);
    let vi;

    if (alreadyExists === -1) {
      group.variants.push({ label: variantLabel, routeData, firestoreId: null });
      vi = group.variants.length - 1;
    } else {
      group.variants[alreadyExists].routeData = routeData;
      vi = alreadyExists;
    }

    renderTree();

    // Auto-save variant to Firestore if logged in
    const user    = window.AuthUI?.getCurrentUser();
    const userDoc = window.AuthUI?.getCurrentUserDoc();
    if (user && window.FirestoreRoutes) {
      const isPublicEl = document.getElementById('chkRoutePublic');
      const isPublic   = isPublicEl ? isPublicEl.checked : true;
      const categories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);
      const description = (document.getElementById('routeDescription')?.value || '').trim();
      try {
        const savedId = await window.FirestoreRoutes.saveRoute({
          routeName:  variantLabel,
          routeData,
          isPublic,
          uid:        user.uid,
          inGameName: userDoc?.inGameName || '',
          routeId:    group.variants[vi]?.firestoreId || null,
          categories,
          description
        });
        group.variants[vi].firestoreId = savedId;
        showToast('Saved to cloud ☁');
      } catch (err) {
        showToast('Saved locally — cloud: ' + err.message);
        console.error('Firestore auto-save error:', err);
      }
      renderTree();
    } else {
      showToast('Sign in to save to cloud');
    }

    // Highlight saved item
    setTimeout(() => {
      const tree = document.getElementById('route-tree');
      if (!tree) return;
      const groupEl = tree.querySelectorAll('.route-group')[gi];
      if (!groupEl) return;
      const childEl = groupEl.querySelectorAll('.route-child')[vi];
      if (childEl) { setActiveEl(childEl, gi, vi); blinkActive(); }
    }, 100);

    RouteProcessor.triggerBlink('saveCacheBtn');
  };

  RouteProcessor.updateRouteList = function () { renderTree(); };

  /* ── WIRE BUTTONS ── */

  const saveWpBtn = document.getElementById('btnSaveWaypoint');
  if (saveWpBtn) saveWpBtn.onclick = saveActiveRouteData;

  // Clear button now just clears in-memory groups (no localStorage to clear)
  const clearBtn = document.getElementById('clearCacheBtn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('Remove all routes from the sidebar?\n(Cloud routes will not be deleted — sign in and refresh to reload them)')) {
        _groups = [];
        _activeRef = null; _activeEl = null;
        renderTree();
      }
    };
  }

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

  /* ── DESCRIPTION CHAR COUNTER ── */
  const descTextarea = document.getElementById('routeDescription');
  const descCounter  = document.getElementById('descCharCount');
  if (descTextarea && descCounter) {
    descTextarea.addEventListener('input', () => {
      const len = descTextarea.value.length;
      descCounter.textContent = `${len} / 280`;
      descCounter.style.color = len > 250 ? (len >= 280 ? '#d95050' : '#f5a623') : 'var(--border2)';
    });
  }

  /* ── AUTH STATE CHANGES ── */

  document.addEventListener('authStateChanged', async (e) => {
    const loggedIn = !!e.detail?.user;
    const visRow = document.getElementById('routeVisibilityRow');
    if (visRow) visRow.style.display = loggedIn ? 'flex' : 'none';

    if (loggedIn) {
      // Load this user's routes from Firestore into the sidebar
      await loadMyCloudRoutes();
    } else {
      // Clear cloud routes on logout, keep any un-saved local ones
      _groups = _groups.filter(g => !g.firestoreId);
      renderTree();
    }
  });

  /* ── INITIAL RENDER ── */
  renderTree();

})();
