/**
 * auto-align.js
 * Auto-aligns waypoint rotations so each gate faces toward the next waypoint.
 *
 * Algorithm:
 *   For each waypoint[i] in the selected range:
 *     - Compute direction vector from waypoint[i].translation → waypoint[i+1].translation
 *     - Derive the yaw angle (rotation around Z axis in the XY game plane)
 *     - Convert to quaternion and write back to waypoint[i].rotation
 *   The last waypoint in range copies the rotation of the second-to-last
 *   (no "next" target exists for it).
 *
 *  Gate orientation note:
 *   The game gate faces along the LOCAL +X axis (depth axis). The map-visualizer
 *   draws each gate perpendicular to the direction line, which means the gate
 *   plane is at 90° to the travel direction. So we rotate the direction vector
 *   by +90° when computing the quaternion so the gate face is perpendicular to travel.
 */

window.AutoAlign = (() => {

  /* ── Helpers ── */
  function toQuat(yawDeg) {
    const rad = (yawDeg * Math.PI) / 180;
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }

  function directionAngle(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // atan2 gives angle of travel; +90 makes gate face perpendicular to travel
    return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  }

  /**
   * alignRange(visualizer, fromIdx, toIdx)
   *   Aligns waypoints [fromIdx … toIdx] inclusive.
   *   Each waypoint rotates to face the next one.
   *   The last waypoint in range keeps the rotation of the previous one.
   */
  function alignRange(visualizer, fromIdx, toIdx) {
    const data = visualizer.getRouteData();
    if (!data || !data.waypoints) return { ok: false, msg: 'No route loaded.' };

    const wps = data.waypoints;
    const n   = wps.length;

    if (fromIdx < 0 || toIdx >= n || fromIdx > toIdx) {
      return { ok: false, msg: `Invalid range: ${fromIdx}–${toIdx} (route has ${n} waypoints)` };
    }

    let changed = 0;
    for (let i = fromIdx; i <= toIdx; i++) {
      const wp   = wps[i];
      const next = wps[i + 1]; // may be undefined if i === last in whole route

      if (next && i < toIdx) {
        // Normal case: point toward next waypoint
        const angle = directionAngle(wp.translation, next.translation);
        wp.rotation = toQuat(angle);
        changed++;
      } else if (i === toIdx && i > fromIdx) {
        // Last WP in range: copy rotation from previous
        wp.rotation = { ...wps[i - 1].rotation };
        changed++;
      } else if (next) {
        // toIdx === fromIdx (single WP) — still align toward the WP after it
        const angle = directionAngle(wp.translation, next.translation);
        wp.rotation = toQuat(angle);
        changed++;
      }
    }

    visualizer.saveRouteData(data);
    visualizer.loadFromOutput();
    return { ok: true, msg: `Auto-aligned ${changed} waypoint${changed !== 1 ? 's' : ''} (${fromIdx}–${toIdx})` };
  }

  /* ── UI Panel ── */
  function buildPanel() {
    if (document.getElementById('autoAlignPanel')) return; // already built

    const panel = document.createElement('div');
    panel.id        = 'autoAlignPanel';
    panel.className = 'auto-align-panel';
    panel.innerHTML = `
      <div class="aa-header">
        <span class="aa-title">⟳ Auto-Align Gates</span>
        <button class="aa-close btn-ghost btn-sm" title="Close">✕</button>
      </div>
      <div class="aa-body">
        <p class="aa-hint">
          Rotates each gate to face the <strong>next</strong> waypoint in the range.
          Perfect for corners — an L-bend gets 45°, a straight gets 0°, a hairpin gets ~180°.
        </p>
        <div class="aa-row">
          <label>From WP</label>
          <input type="number" id="aaFrom" min="0" value="0" />
        </div>
        <div class="aa-row">
          <label>To WP</label>
          <input type="number" id="aaTo"   min="0" value="0" />
        </div>
        <div class="aa-row aa-quick">
          <button class="btn-ghost btn-sm" id="aaSelectAll">All</button>
          <button class="btn-ghost btn-sm" id="aaFromActive">From Active</button>
          <button class="btn-ghost btn-sm" id="aaToActive">To Active</button>
        </div>
        <div class="aa-preview" id="aaPreview"></div>
        <button class="btn-primary btn-full" id="aaRun">⟳ Align Waypoints</button>
        <div class="aa-result" id="aaResult"></div>
      </div>
    `;

    // Insert after the inspector panel in the right sidebar
    const processBody = document.querySelector('.process-body');
    if (processBody) {
      processBody.insertBefore(panel, processBody.firstChild);
    } else {
      document.getElementById('pane-process')?.appendChild(panel);
    }

    // Wire close
    panel.querySelector('.aa-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Wire "All" — sets range to full route
    document.getElementById('aaSelectAll').addEventListener('click', () => {
      const v = window._globalVisualizer;
      if (!v) return;
      const data = v.getRouteData();
      if (!data?.waypoints?.length) return;
      document.getElementById('aaFrom').value = 0;
      document.getElementById('aaTo').value   = data.waypoints.length - 1;
      updatePreview();
    });

    // Wire "From Active" / "To Active"
    document.getElementById('aaFromActive').addEventListener('click', () => {
      const v = window._globalVisualizer;
      if (!v) return;
      const idx = v.getActiveWaypoint?.() ?? -1;
      if (idx >= 0) { document.getElementById('aaFrom').value = idx; updatePreview(); }
    });
    document.getElementById('aaToActive').addEventListener('click', () => {
      const v = window._globalVisualizer;
      if (!v) return;
      const idx = v.getActiveWaypoint?.() ?? -1;
      if (idx >= 0) { document.getElementById('aaTo').value = idx; updatePreview(); }
    });

    document.getElementById('aaFrom').addEventListener('input', updatePreview);
    document.getElementById('aaTo').addEventListener('input', updatePreview);

    // Wire run
    document.getElementById('aaRun').addEventListener('click', () => {
      const v = window._globalVisualizer;
      if (!v) { showResult('No route visualizer found.', false); return; }
      const from = parseInt(document.getElementById('aaFrom').value);
      const to   = parseInt(document.getElementById('aaTo').value);
      const res  = alignRange(v, from, to);
      showResult(res.msg, res.ok);
      if (res.ok) updatePreview();
    });
  }

  function updatePreview() {
    const v = window._globalVisualizer;
    const el = document.getElementById('aaPreview');
    if (!el) return;
    if (!v) { el.textContent = ''; return; }
    const data = v.getRouteData();
    if (!data?.waypoints) { el.textContent = ''; return; }
    const from = parseInt(document.getElementById('aaFrom')?.value ?? 0);
    const to   = parseInt(document.getElementById('aaTo')?.value ?? 0);
    const total = data.waypoints.length;
    const count = Math.max(0, to - from + 1);
    el.textContent = `${count} waypoint${count !== 1 ? 's' : ''} selected of ${total} total`;
    el.style.color = count > 0 ? 'var(--text)' : 'var(--muted)';
  }

  function showResult(msg, ok) {
    const el = document.getElementById('aaResult');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? 'var(--green, #4caf50)' : '#d95050';
    setTimeout(() => { el.textContent = ''; }, 4000);
  }

  /* ── Public ── */
  return {
    init(visualizer) {
      window._globalVisualizer = visualizer;
      buildPanel();
      updatePreview();
    },
    openPanel() {
      const p = document.getElementById('autoAlignPanel');
      if (p) {
        p.style.display = 'block';
        updatePreview();
      } else {
        buildPanel();
        updatePreview();
      }
    },
    alignRange
  };
})();
