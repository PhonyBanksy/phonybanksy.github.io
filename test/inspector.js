/**
 * inspector.js
 * Manages the Waypoint Inspector panel in the right sidebar.
 * Replaces the old floating #wpContext context menu.
 *
 * API (window.Inspector):
 *   Inspector.populate(waypointCount)  — rebuild the dropdown
 *   Inspector.select(index)            — select a waypoint by index
 *   Inspector.getSelectedIndex()       — returns current index or -1
 */

window.Inspector = (function () {
  'use strict';

  const wpSelect   = document.getElementById('wpSelect');
  const wpIndexLbl = document.getElementById('inspectorWpLabel');
  const emptyMsg   = document.getElementById('inspectorEmpty');
  const body       = document.getElementById('inspectorBody');

  const inpWidth   = document.getElementById('inpWidth');   // Y = gate width
  const inpHeight  = document.getElementById('inpHeight');  // X = depth
  const inpDepth   = document.getElementById('inpDepth');   // Z = height
  const rotSlider  = document.getElementById('rotSlider');
  const rotVal     = document.getElementById('rotateVal');
  const saveBtn    = document.getElementById('btnSaveWaypoint');

  let _selectedIndex = -1;

  /* ── HELPERS ── */

  function getRouteData() {
    try { return JSON.parse(document.getElementById('output').value); }
    catch (_) { return null; }
  }

  function saveRouteData(data) {
    const str = JSON.stringify(data, null, 2);
    document.getElementById('output').value   = str;
    document.getElementById('json_data').value = str;
  }

  function toAngle(q) {
    return q ? (2 * Math.atan2(q.z, q.w)) * (180 / Math.PI) : 0;
  }

  function toQuat(deg) {
    const rad = deg * (Math.PI / 180);
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }

  function showBody(visible) {
    emptyMsg.style.display = visible ? 'none' : 'block';
    body.style.display     = visible ? 'flex'  : 'none';
  }

  /* ── PUBLIC ── */

  function populate(waypointCount) {
    const prev = _selectedIndex;
    wpSelect.innerHTML = '<option value="-1">— select waypoint —</option>';
    for (let i = 0; i < waypointCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `#${i}${i === 0 ? '  START' : i === waypointCount - 1 ? '  FINISH' : ''}`;
      wpSelect.appendChild(opt);
    }
    // Restore selection if still valid
    if (prev >= 0 && prev < waypointCount) {
      wpSelect.value = prev;
    } else {
      wpSelect.value = -1;
      _selectedIndex = -1;
      showBody(false);
    }
  }

  function select(index) {
    const data = getRouteData();
    if (!data || !data.waypoints) { showBody(false); return; }

    if (index < 0 || index >= data.waypoints.length) {
      _selectedIndex = -1;
      wpSelect.value = -1;
      showBody(false);
      return;
    }

    _selectedIndex = index;
    wpSelect.value = index;

    const wp = data.waypoints[index];
    const s  = wp.scale3D || { x: 1, y: 10, z: 1 };
    const angle = Math.round(toAngle(wp.rotation));

    inpWidth.value  = parseFloat(s.y) || 10;
    inpHeight.value = parseFloat(s.x) || 1;
    inpDepth.value  = parseFloat(s.z) || 1;
    rotSlider.value = angle;
    rotVal.textContent = angle;

    if (wpIndexLbl) wpIndexLbl.textContent = `WP #${index}`;
    showBody(true);
  }

  function getSelectedIndex() { return _selectedIndex; }

  /* ── DIMENSION INPUTS ── */
  function updateDims() {
    if (_selectedIndex === -1) return;
    const data = getRouteData();
    if (!data || !data.waypoints[_selectedIndex]) return;
    if (!data.waypoints[_selectedIndex].scale3D) data.waypoints[_selectedIndex].scale3D = {};
    data.waypoints[_selectedIndex].scale3D.y = parseFloat(inpWidth.value)  || 0;
    data.waypoints[_selectedIndex].scale3D.x = parseFloat(inpHeight.value) || 0;
    data.waypoints[_selectedIndex].scale3D.z = parseFloat(inpDepth.value)  || 0;
    saveRouteData(data);
    if (window.MapVisualizerInstance) window.MapVisualizerInstance.draw();
  }

  if (inpWidth)  inpWidth.oninput  = updateDims;
  if (inpHeight) inpHeight.oninput = updateDims;
  if (inpDepth)  inpDepth.oninput  = updateDims;

  /* ── ROTATION SLIDER ── */
  if (rotSlider) {
    rotSlider.oninput = (e) => {
      if (_selectedIndex === -1) return;
      const deg = parseFloat(e.target.value);
      if (rotVal) rotVal.textContent = deg;
      const data = getRouteData();
      if (!data || !data.waypoints[_selectedIndex]) return;
      data.waypoints[_selectedIndex].rotation = toQuat(deg);
      saveRouteData(data);
      if (window.MapVisualizerInstance) window.MapVisualizerInstance.draw();
    };
  }

  /* ── DROPDOWN CHANGE ── */
  if (wpSelect) {
    wpSelect.onchange = () => {
      const idx = parseInt(wpSelect.value);
      select(idx);
      if (window.MapVisualizerInstance) {
        window.MapVisualizerInstance.setActiveWaypoint(idx);
        window.MapVisualizerInstance.draw();
      }
    };
  }

  /* ── SAVE BUTTON (persists edits to route group storage) ── */
  // Wired externally by main-overrides.js so it can reach saveActiveRouteData()

  showBody(false);

  return { populate, select, getSelectedIndex };
})();
