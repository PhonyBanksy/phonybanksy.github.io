/**
 * main-overrides.js
 * - Hierarchical route tree (parent + collapsible variants)
 * - Active route highlighting + blink on save
 * - Save Changes button for waypoint edits
 * - Import/Export clipboard buttons
 * - Clipboard fix
 */

(function () {
  'use strict';

  /* ── ACTIVE ROUTE TRACKING ──────────────────────────────────── */
  // Tracks { gi, vi } — group index + variant index (-1 = base)
  let _activeRef = null;
  let _activeEl  = null;   // the DOM element currently highlighted

  /* ── STORAGE ────────────────────────────────────────────────── */

  function loadGroups() {
    try {
      const raw = localStorage.getItem('routeGroups');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    // Migrate old flat routes array
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

  /* ── TOAST ──────────────────────────────────────────────────── */

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg || 'Done';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  /* ── CLIPBOARD ──────────────────────────────────────────────── */

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
    try { document.execCommand('copy'); showToast('Copied!'); } catch (_) { showToast('Copy failed'); }
    ta.remove();
  }

  /* ── BLINK ACTIVE SIDEBAR ITEM ──────────────────────────────── */

  function blinkActive() {
    if (!_activeEl) return;
    _activeEl.classList.remove('sidebar-blink');
    // Force reflow so animation restarts
    void _activeEl.offsetWidth;
    _activeEl.classList.add('sidebar-blink');
    setTimeout(() => _activeEl && _activeEl.classList.remove('sidebar-blink'), 600);
  }

  /* ── ROUTE TREE RENDER ──────────────────────────────────────── */

  function renderTree() {
    const tree = document.getElementById('route-tree');
    const empty = document.getElementById('route-empty');
    if (!tree) return;

    tree.querySelectorAll('.route-group').forEach(el => el.remove());

    const groups = loadGroups();

    if (!groups.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    groups.forEach((group, gi) => {
      tree.appendChild(buildGroupEl(group, gi, groups));
    });

    // Re-apply active highlight after re-render
    if (_activeRef) {
      const { gi, vi } = _activeRef;
      const groupEls = tree.querySelectorAll('.route-group');
      const groupEl = groupEls[gi];
      if (groupEl) {
        if (vi === -1) {
          const parent = groupEl.querySelector('.route-parent');
          if (parent) { parent.classList.add('active'); _activeEl = parent; }
        } else {
          const children = groupEl.querySelectorAll('.route-child');
          const child = children[vi];
          if (child) { child.classList.add('active'); _activeEl = child; }
        }
      }
    }
  }

  function buildGroupEl(group, gi, groups) {
    const wrap = document.createElement('div');
    wrap.className = 'route-group';

    const hasVariants = group.variants && group.variants.length > 0;
    const collapsed = group._collapsed || false;

    /* Parent row */
    const parent = document.createElement('div');
    parent.className = 'route-parent';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'route-parent-load';
    loadBtn.innerHTML = `<span class="route-icon">🗺</span><span class="route-parent-name">${escHtml(group.baseName)}</span>`;
    loadBtn.title = 'Load base route';
    loadBtn.onclick = () => {
      setActiveEl(parent, gi, -1);
      loadIntoEditor(group.baseData);
    };
    parent.appendChild(loadBtn);

    if (hasVariants) {
      const colBtn = document.createElement('button');
      colBtn.className = 'route-collapse-btn';
      colBtn.title = collapsed ? 'Expand' : 'Collapse';
      colBtn.textContent = collapsed ? '▸' : '▾';
      colBtn.onclick = () => {
        group._collapsed = !group._collapsed;
        saveGroups(groups);
        renderTree();
      };
      parent.appendChild(colBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'route-delete-btn';
    delBtn.title = 'Delete route';
    delBtn.textContent = '×';
    delBtn.onclick = () => {
      if (confirm(`Delete "${group.baseName}" and all variants?`)) {
        groups.splice(gi, 1);
        saveGroups(groups);
        if (_activeRef && _activeRef.gi === gi) { _activeRef = null; _activeEl = null; }
        renderTree();
      }
    };
    parent.appendChild(delBtn);
    wrap.appendChild(parent);

    /* Children */
    if (hasVariants) {
      const childList = document.createElement('div');
      childList.className = 'route-children' + (collapsed ? ' collapsed' : '');

      group.variants.forEach((v, vi) => {
        const child = document.createElement('div');
        child.className = 'route-child';

        const childLoad = document.createElement('button');
        childLoad.className = 'route-child-load';
        childLoad.innerHTML = `<span style="color:var(--accent);font-size:10px;">↳</span><span class="child-label">${escHtml(v.label)}</span>`;
        childLoad.title = 'Load variant';
        childLoad.onclick = () => {
          setActiveEl(child, gi, vi);
          loadIntoEditor(v.routeData);
        };

        const childDel = document.createElement('button');
        childDel.className = 'route-child-delete';
        childDel.title = 'Delete variant';
        childDel.textContent = '×';
        childDel.onclick = (e) => {
          e.stopPropagation();
          group.variants.splice(vi, 1);
          saveGroups(groups);
          if (_activeRef && _activeRef.gi === gi && _activeRef.vi === vi) { _activeRef = null; _activeEl = null; }
          renderTree();
        };

        child.appendChild(childLoad);
        child.appendChild(childDel);
        childList.appendChild(child);
      });

      wrap.appendChild(childList);
    }

    return wrap;
  }

  function setActiveEl(el, gi, vi) {
    document.querySelectorAll('.route-parent, .route-child').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    _activeEl = el;
    _activeRef = { gi, vi };
  }

  function loadIntoEditor(routeData) {
    const str = JSON.stringify(routeData, null, 2);
    const inputEl  = document.getElementById('json_data');
    const outputEl = document.getElementById('output');
    if (inputEl)  inputEl.value  = str;
    if (outputEl) outputEl.value = str;
    if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
  }

  /* ── UPDATE ACTIVE ROUTE'S STORED DATA ─────────────────────── */
  // Called by Save Changes button — persists current output JSON
  // back into the correct group/variant slot in localStorage.

  function saveActiveRouteData() {
    if (!_activeRef) { showToast('No route selected'); return; }

    // Read from the output textarea — map-visualizer.js keeps this up to date
    // via saveRouteData() whenever you edit a waypoint's dimensions/rotation.
    const outputEl = document.getElementById('output');
    const raw = outputEl ? outputEl.value.trim() : '';
    if (!raw) { showToast('No output to save'); return; }

    let routeData;
    try { routeData = JSON.parse(raw); }
    catch (_) { showToast('Invalid JSON in output'); return; }

    // Write directly into the stored group without re-rendering the tree
    // (re-rendering would wipe _activeEl before blinkActive can use it)
    const groups = loadGroups();
    const { gi, vi } = _activeRef;
    if (!groups[gi]) { showToast('Route not found'); return; }

    if (vi === -1) {
      groups[gi].baseData = routeData;
    } else {
      if (groups[gi].variants[vi] === undefined) { showToast('Variant not found'); return; }
      groups[gi].variants[vi].routeData = routeData;
    }

    saveGroups(groups);

    // Blink BEFORE renderTree so _activeEl is still valid
    blinkActive();
    showToast('Saved!');

    // Re-render tree after a short delay (after blink starts)
    setTimeout(() => renderTree(), 50);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── INTERCEPT saveRouteToLocalStorage ──────────────────────── */

  const _origSave = RouteProcessor.saveRouteToLocalStorage.bind(RouteProcessor);

  RouteProcessor.saveRouteToLocalStorage = function(routeName, routeData) {
    const groups = loadGroups();
    const inputEl = document.getElementById('json_data');

    let baseName = 'Route';
    try {
      const inputData = JSON.parse(inputEl ? inputEl.value : '{}');
      baseName = inputData.routeName || routeData.routeName || 'Route';
    } catch (_) {
      baseName = routeData.routeName || 'Route';
    }

    const variantLabel = routeName.trim();
    let group = groups.find(g => g.baseName === baseName);

    if (!group) {
      let baseData = routeData;
      try { baseData = JSON.parse(inputEl ? inputEl.value : '{}'); } catch (_) {}
      group = { baseName, baseData, variants: [], _collapsed: false };
      groups.push(group);
    }

    const gi = groups.indexOf(group);
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

    // Highlight the new/updated variant
    setTimeout(() => {
      const tree = document.getElementById('route-tree');
      if (!tree) return;
      const groupEls = tree.querySelectorAll('.route-group');
      const groupEl  = groupEls[gi];
      if (!groupEl) return;
      const children = groupEl.querySelectorAll('.route-child');
      const childEl  = children[vi];
      if (childEl) {
        setActiveEl(childEl, gi, vi);
        blinkActive();
      }
    }, 50);

    RouteProcessor.triggerBlink('saveCacheBtn');
  };

  RouteProcessor.updateRouteList = function() { renderTree(); };

  /* ── WIRE SAVE CHANGES BUTTON ───────────────────────────────── */

  const saveWpBtn = document.getElementById('btnSaveWaypoint');
  if (saveWpBtn) saveWpBtn.onclick = saveActiveRouteData;

  /* ── CLEAR ALL ──────────────────────────────────────────────── */

  document.getElementById('clearCacheBtn').onclick = () => {
    if (confirm('Delete ALL saved routes and variants?')) {
      localStorage.removeItem('routeGroups');
      localStorage.removeItem('routes');
      _activeRef = null; _activeEl = null;
      renderTree();
    }
  };

  /* ── COPY OUTPUT BUTTON ─────────────────────────────────────── */

  const copyBtn = document.getElementById('copyOutputBtn');
  if (copyBtn) copyBtn.onclick = () => {
    const out = document.getElementById('output');
    copyText(out ? out.value : '');
  };

  /* ── IMPORT FROM WEBSITE ────────────────────────────────────── */
  // Reads clipboard → pastes into Input field + renders on map.
  document.getElementById('importFromWebBtn').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) throw new Error('Not JSON');
      const inputEl  = document.getElementById('json_data');
      const outputEl = document.getElementById('output');
      if (inputEl)  inputEl.value  = trimmed;
      if (outputEl) outputEl.value = trimmed;
      if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
      showToast('Route imported!');
    } catch (_) {
      // Clipboard permission denied or not JSON — open JSON tab and focus input
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      const jsonTab = document.querySelector('[data-pane="pane-json"]');
      if (jsonTab) { jsonTab.classList.add('on'); document.getElementById('pane-json').classList.add('on'); }
      const inputEl = document.getElementById('json_data');
      if (inputEl) inputEl.focus();
      showToast('Paste your JSON in the Input box');
    }
  };

  /* ── EXPORT TO WEBSITE ──────────────────────────────────────── */
  // Copies Output field → clipboard.
  document.getElementById('exportToWebBtn').onclick = () => {
    const out = document.getElementById('output');
    const text = out ? out.value.trim() : '';
    if (!text) { showToast('No output to export yet'); return; }
    copyText(text);
  };

  /* ── FIX WAYPOINT AXIS MAPPING ─────────────────────────────── */
  // map-visualizer.js has: inpW(Width field) → scale3D.y, inpH(Height) → scale3D.x
  // This is backwards from the game's actual axes (X=width across, Y=height, Z=depth).
  // We override the oninput handlers AFTER map-visualizer.js has wired them up.
  // We also need to fix openMenu's population of the fields — we do that by patching
  // the MapVisualizerInstance after it's created by main.js.

  function fixAxisWiring() {
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');
    if (!inpW || !inpH || !inpD) return;
    if (!window.MapVisualizerInstance) return;

    function updateDimsFixed() {
      // Get active waypoint index from the menu title ("Waypoint #N")
      const idx = getOpenWaypointIndex();
      if (idx === -1) return;

      const data = window.MapVisualizerInstance.getRouteData();
      if (!data || !data.waypoints[idx]) return;
      if (!data.waypoints[idx].scale3D) data.waypoints[idx].scale3D = {};

      // X=depth, Y=gate width, Z=height
      data.waypoints[idx].scale3D.y = parseFloat(inpW.value) || 0;  // inpWidth  → Y (gate width)
      data.waypoints[idx].scale3D.x = parseFloat(inpH.value) || 0;  // inpHeight → X (depth)
      data.waypoints[idx].scale3D.z = parseFloat(inpD.value) || 0;  // inpDepth  → Z (height)

      window.MapVisualizerInstance.saveRouteData(data);
    }

    // Replace map-visualizer's swapped handlers with correct ones
    inpW.oninput = updateDimsFixed;
    inpH.oninput = updateDimsFixed;
    inpD.oninput = updateDimsFixed;
  }

  // Patch MapVisualizerInstance.openMenu equivalent by overriding the global openMenu
  // that map-visualizer exposes, so we populate fields with correct axes on open.
  // We do this after a tick to ensure MapVisualizerInstance is assigned by main.js.
  setTimeout(() => {
    fixAxisWiring();

    // Override the waypoint context menu population to use correct X/Y/Z order
    // map-visualizer's openMenu runs inside its closure, but we can re-populate
    // the fields after it opens by observing display changes on wpContext.
    const menu = document.getElementById('wpContext');
    if (!menu) return;

    const observer = new MutationObserver(() => {
      if (menu.style.display === 'block') {
        // Menu just opened — fix the field values using correct axis mapping
        const inpW = document.getElementById('inpWidth');
        const inpH = document.getElementById('inpHeight');
        const inpD = document.getElementById('inpDepth');
        if (!inpW || !inpH || !inpD) return;

        const idx = getOpenWaypointIndex();
        if (idx === -1) return;

        const data = window.MapVisualizerInstance && window.MapVisualizerInstance.getRouteData();
        if (!data || !data.waypoints[idx]) return;

        const s = data.waypoints[idx].scale3D || { x: 1, y: 10, z: 1 };
        inpW.value = parseFloat(s.y) || 10;  // inpWidth  → Y (gate width)
        inpH.value = parseFloat(s.x) || 1;   // inpHeight → X (depth)
        inpD.value = parseFloat(s.z) || 1;   // inpDepth  → Z (height)
      }
    });
    observer.observe(menu, { attributes: true, attributeFilter: ['style'] });
  }, 200);

  // map-visualizer calls openMenu(index) locally; we need to know which index is open.
  // We intercept by watching wpTitle text which is set to "Waypoint #N"
  function getOpenWaypointIndex() {
    const title = document.getElementById('wpTitle');
    if (!title) return -1;
    const m = title.textContent.match(/#(\d+)/);
    return m ? parseInt(m[1]) : -1;
  }

  /* ── INITIAL RENDER ─────────────────────────────────────────── */
  renderTree();

})();
