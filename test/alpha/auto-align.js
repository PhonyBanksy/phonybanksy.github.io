a/**
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

  function toQuat(yawDeg) {
    const rad = (yawDeg * Math.PI) / 180;
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }

  /**
   * calculateBisectorAngle(prev, curr, next)
   * Finds the angle that bisects the corner formed by three waypoints.
   */
  function calculateBisectorAngle(prev, curr, next) {
    // Angle of incoming path
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    // Angle of outgoing path
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    
    // Calculate difference and normalize to (-PI, PI]
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    // The bisector of the travel path
    const bisectorTravel = a1 + diff / 2;
    
    // Add 90 degrees to make the gate face perpendicular to the corner cut
    return (bisectorTravel * 180 / Math.PI) + 90;
  }

  function alignRange(visualizer, fromIdx, toIdx) {
    const data = visualizer.getRouteData();
    if (!data?.waypoints) return;
    const wps = data.waypoints;

    for (let i = fromIdx; i <= toIdx; i++) {
      const prev = wps[i - 1];
      const curr = wps[i];
      const next = wps[i + 1];

      let angle;
      if (prev && next) {
        // CORNER CASE: Bisect the angle between incoming and outgoing paths
        angle = calculateBisectorAngle(prev.translation, curr.translation, next.translation);
      } else if (next) {
        // START OF RANGE/TRACK: Face directly toward the next waypoint
        angle = Math.atan2(next.translation.y - curr.translation.y, next.translation.x - curr.translation.x) * (180 / Math.PI) + 90;
      } else if (prev) {
        // END OF RANGE/TRACK: Use the direction from the previous waypoint
        angle = Math.atan2(curr.translation.y - prev.translation.y, curr.translation.x - prev.translation.x) * (180 / Math.PI) + 90;
      }
      
      if (angle !== undefined) {
        curr.rotation = toQuat(angle);
      }
    }

    visualizer.saveRouteData(data);
    visualizer.loadFromOutput();
  }

  return {
    init(visualizer) {
      const btn = document.getElementById('btnAutoAlign');
      if (!btn) return;

      btn.addEventListener('click', () => {
        const fromInput = document.getElementById('aaFrom');
        const toInput   = document.getElementById('aaTo');
        
        const from = parseInt(fromInput.value);
        const to   = parseInt(toInput.value);

        if (isNaN(from) || isNaN(to)) {
          alert("Please enter both From and To waypoint indices.");
          return;
        }

        alignRange(visualizer, from, to);
        
        // Brief visual success feedback
        const originalText = btn.textContent;
        btn.textContent = "✔ Aligned";
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.replace('btn-success', 'btn-primary');
        }, 1500);
      });

      // Convenience: clicking a waypoint on map fills the range inputs
      window.addEventListener('waypointSelected', (e) => {
        const idx = e.detail.index;
        const fromInput = document.getElementById('aaFrom');
        const toInput   = document.getElementById('aaTo');
        
        // If From is empty, fill it. Otherwise fill To.
        if (fromInput.value === "") {
          fromInput.value = idx;
        } else {
          toInput.value = idx;
        }
      });
    }
  };
})();