/**
 * auto-align.js
 * Aligns waypoints based on the bisector of the angle between neighbors.
 */

window.AutoAlign = (() => {

  function toQuat(yawDeg) {
    const rad = (yawDeg * Math.PI) / 180;
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }

  function calculateBisector(prev, curr, next) {
    // Angle of incoming path (prev -> curr)
    const inAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    // Angle of outgoing path (curr -> next)
    const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);

    let diff = outAngle - inAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // The bisector of the corner
    const resultRad = inAngle + (diff / 2);
    // Convert to degrees and add 90 to make the gate face "into" the turn
    return (resultRad * 180 / Math.PI);
  }

  function alignRange(visualizer, fromIdx, toIdx) {
    const data = visualizer.getRouteData();
    if (!data?.waypoints) return;
    const wps = data.waypoints;

    for (let i = fromIdx; i <= toIdx; i++) {
      const p = wps[i-1]?.translation;
      const c = wps[i]?.translation;
      const n = wps[i+1]?.translation;

      let yaw;
      if (p && n) {
        yaw = calculateBisector(p, c, n);
      } else if (n) {
        yaw = Math.atan2(n.y - c.y, n.x - c.x) * (180 / Math.PI) + 90;
      } else if (p) {
        yaw = Math.atan2(c.y - p.y, c.x - p.x) * (180 / Math.PI) + 90;
      }

      if (yaw !== undefined) wps[i].rotation = toQuat(yaw);
    }

    visualizer.saveRouteData(data);
    visualizer.loadFromOutput();
  }

  return {
    init(visualizer) {
      const btn = document.getElementById('btnAutoAlignTop');
      if (!btn) return;

      btn.addEventListener('click', () => {
        const from = parseInt(document.getElementById('aaFrom').value);
        const to   = parseInt(document.getElementById('aaTo').value);
        if (isNaN(from) || isNaN(to)) return alert("Set From and To indices first!");
        
        alignRange(visualizer, from, to);
        btn.style.background = "var(--green)";
        setTimeout(() => btn.style.background = "", 1000);
      });

      window.addEventListener('waypointSelected', (e) => {
        const idx = e.detail.index;
        const f = document.getElementById('aaFrom');
        const t = document.getElementById('aaTo');
        if (f.value === "") f.value = idx; else t.value = idx;
      });
    }
  };
})();