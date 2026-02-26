/**
 * auto-align.js
 * Aligns the rotation of the selected waypoint to bisect the path angle.
 */

window.AutoAlign = (() => {
  let currentSelectedIndex = -1;

  function toQuat(yawDeg) {
    const rad = (yawDeg * Math.PI) / 180;
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }

  function calculateBisector(prev, curr, next) {
    // Road direction coming in
    const inAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    // Road direction going out
    const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);

    let diff = outAngle - inAngle;
    // Normalize difference to ensure shortest turn
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // Divide by 2 to find the middle angle of the bend
    const resultRad = inAngle + (diff / 2);
    // Convert back to degrees for the game engine
    return (resultRad * 180 / Math.PI);
  }

  function alignActiveWaypoint(visualizer) {
    if (currentSelectedIndex === -1) return;

    const data = visualizer.getRouteData();
    if (!data?.waypoints) return;
    
    const wps = data.waypoints;
    const idx = currentSelectedIndex;
    
    const p = wps[idx - 1]?.translation;
    const c = wps[idx]?.translation;
    const n = wps[idx + 1]?.translation;

    let yaw;
    if (p && n) {
      // Logic for corners/straight roads: bisect neighbor angles
      yaw = calculateBisector(p, c, n);
    } else if (n) {
      // Start point: face toward the next point
      yaw = Math.atan2(n.y - c.y, n.x - c.x) * (180 / Math.PI);
    } else if (p) {
      // End point: face away from the previous point
      yaw = Math.atan2(c.y - p.y, c.x - p.x) * (180 / Math.PI);
    }

    if (yaw !== undefined) {
      wps[idx].rotation = toQuat(yaw);
      visualizer.saveRouteData(data);
      visualizer.loadFromOutput();
    }
  }

  return {
    init(visualizer) {
      const btn = document.getElementById('btnAutoAlignSingle');
      const statusLabel = document.getElementById('aaStatusLabel');
      if (!btn) return;

      btn.addEventListener('click', () => {
        if (currentSelectedIndex === -1) {
          alert("Click a waypoint on the map first!");
          return;
        }
        alignActiveWaypoint(visualizer);
        
        // Visual feedback
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => btn.classList.replace('btn-success', 'btn-primary'), 800);
      });

      // Listen for waypoint selection from map-visualizer/waypoint-ui
      window.addEventListener('waypointSelected', (e) => {
        currentSelectedIndex = e.detail.index;
        if (statusLabel) {
          statusLabel.textContent = `Waypoint #${currentSelectedIndex} selected`;
          statusLabel.style.color = "var(--accent)";
        }
      });
    }
  };
})();