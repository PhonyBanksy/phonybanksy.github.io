/**
 * map-visualizer.js
 * Renders the route on a canvas. On waypoint click, delegates to Inspector panel
 * instead of showing a floating context menu.
 */

window.MapVisualizer = function (canvasContainerId = 'routeCanvas', outputFieldId = 'output') {
  const container = document.getElementById(canvasContainerId);
  const canvas    = document.createElement('canvas');
  const ctx       = canvas.getContext('2d');
  container.appendChild(canvas);

  // Map load UI
  const mapInput   = document.getElementById('mapUpload');
  const btnLoadMap = document.getElementById('btnLoadMap');
  const statusText = document.getElementById('mapStatus');

  // Map config: 4000×4000 image, game-world origin offset
  const mapConfig = {
    width: 4000, height: 4000,
    gameOffsetX: 2381, gameOffsetY: 574,
    scale: 0.002
  };

  let mapImage  = new Image();
  let mapLoaded = false;

  let view = { x: 0, y: 0, zoom: 0.5, dragging: false, startX: 0, startY: 0 };
  let waypointsRendered = [];
  let activeWpIndex     = -1;

  /* ── HELPERS ── */
  const toAngle = (q) => q ? (2 * Math.atan2(q.z, q.w)) * (180 / Math.PI) : 0;

  const gameToScreen = (gx, gy) => {
    const mx = (gx * mapConfig.scale * 0.93) + mapConfig.gameOffsetX - mapConfig.width  / 2;
    const my = (gy * mapConfig.scale * 0.93) + mapConfig.gameOffsetY - mapConfig.height / 2;
    return {
      x: (mx * view.zoom) + view.x + canvas.width  / 2,
      y: (my * view.zoom) + view.y + canvas.height / 2
    };
  };

  /* ── FIT VIEW TO WAYPOINTS ── */
  const fitToWaypoints = (waypoints) => {
    if (!waypoints || waypoints.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    waypoints.forEach(wp => {
      const p = gameToScreen(wp.translation.x, wp.translation.y);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    // Reset view to identity first so gameToScreen works correctly
    view.x = 0; view.y = 0; view.zoom = 1;
    // Recalculate with base zoom=1
    minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
    waypoints.forEach(wp => {
      const p = gameToScreen(wp.translation.x, wp.translation.y);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const w = canvas.width  || container.clientWidth;
    const h = canvas.height || container.clientHeight;
    const routeW = maxX - minX || 1;
    const routeH = maxY - minY || 1;
    const padding = 80;
    const zoomX = (w - padding * 2) / routeW;
    const zoomY = (h - padding * 2) / routeH;
    view.zoom = Math.max(0.05, Math.min(zoomX, zoomY, 5));
    // Centre of route in screen coords at zoom=1
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    view.x = w / 2 - cx * view.zoom;
    view.y = h / 2 - cy * view.zoom;
  };

  /* ── INSTANCE ── */
  const instance = {
    loadFromOutput: () => {
      // Rebuild inspector dropdown when route data changes
      const data = instance.getRouteData();
      if (window.Inspector && data && data.waypoints) {
        window.Inspector.populate(data.waypoints.length);
      }
      // Auto-fit map view to waypoints
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      if (data && data.waypoints && data.waypoints.length > 0) {
        fitToWaypoints(data.waypoints);
      }
      instance.draw();
    },

    getRouteData: () => {
      try { return JSON.parse(document.getElementById(outputFieldId).value); }
      catch (_) { return null; }
    },

    saveRouteData: (data) => {
      const str = JSON.stringify(data, null, 2);
      document.getElementById(outputFieldId).value  = str;
      document.getElementById('json_data').value    = str;
    },

    setActiveWaypoint: (index) => {
      activeWpIndex = index;
    },

    draw: () => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Map background
      ctx.save();
      ctx.translate(canvas.width / 2 + view.x, canvas.height / 2 + view.y);
      ctx.scale(view.zoom, view.zoom);
      if (mapLoaded) {
        ctx.drawImage(mapImage, -mapConfig.width / 2, -mapConfig.height / 2);
      } else {
        ctx.strokeStyle = '#555';
        ctx.lineWidth   = 10;
        ctx.strokeRect(-mapConfig.width / 2, -mapConfig.height / 2, mapConfig.width, mapConfig.height);
        ctx.fillStyle   = '#fff';
        ctx.font        = '50px Arial';
        ctx.textAlign   = 'center';
        ctx.fillText('Map not loaded', 0, 0);
      }
      ctx.restore();

      const data = instance.getRouteData();
      waypointsRendered = [];
      if (!data || !data.waypoints) return;

      // Route line
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.waypoints.forEach((wp, i) => {
        const pos = gameToScreen(wp.translation.x, wp.translation.y);
        i === 0 ? ctx.moveTo(pos.x, pos.y) : ctx.lineTo(pos.x, pos.y);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();

      // Waypoints
      data.waypoints.forEach((wp, i) => {
        const pos        = gameToScreen(wp.translation.x, wp.translation.y);
        const isSelected = (i === activeWpIndex);
        waypointsRendered.push({ i, x: pos.x, y: pos.y });

        // Gate direction line (+90° offset for correct orientation)
        const rad     = (toAngle(wp.rotation) + 90) * (Math.PI / 180);
        const gateLen = 30 * view.zoom;
        const dx      = Math.cos(rad) * gateLen;
        const dy      = Math.sin(rad) * gateLen;
        ctx.beginPath();
        ctx.moveTo(pos.x - dx, pos.y - dy);
        ctx.lineTo(pos.x + dx, pos.y + dy);
        ctx.strokeStyle = isSelected ? '#ffff00' : '#00ff00';
        ctx.lineWidth   = isSelected ? 4 : 3;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle   = isSelected ? '#ffff00' : '#00bfff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#fff';
        ctx.font      = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`#${i}`, pos.x + 8, pos.y - 8);

        if (i === 0) {
          ctx.fillStyle = '#4caf50';
          ctx.font      = 'bold 14px Arial';
          ctx.fillText('START', pos.x + 8, pos.y + 15);
        } else if (i === data.waypoints.length - 1) {
          ctx.fillStyle = '#ff4d4d';
          ctx.font      = 'bold 14px Arial';
          ctx.fillText('FINISH', pos.x + 8, pos.y + 15);
        }
      });
    }
  };

  /* ── MAP LOADING ── */
  mapImage.onload = () => {
    mapLoaded = true;
    statusText.textContent = 'Map Loaded (map.jpg)';
    statusText.style.color = '#4caf50';
    instance.draw();
  };
  mapImage.onerror = () => {
    mapLoaded = false;
    statusText.textContent = 'Auto-load failed. Select map manually.';
    statusText.style.color = '#ff9800';
    instance.draw();
  };
  mapImage.src = 'map.jpg';

  btnLoadMap.onclick = () => mapInput.click();
  mapInput.onchange  = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      mapImage        = new Image();
      mapImage.onload = () => {
        mapLoaded = true;
        statusText.textContent = 'Custom Map Loaded';
        statusText.style.color = '#4caf50';
        instance.draw();
      };
      mapImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  /* ── MOUSE: ZOOM ── */
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta   = -Math.sign(e.deltaY) * 0.1;
    const newZoom = Math.max(0.05, Math.min(view.zoom + delta, 5));
    const mouseX  = e.offsetX - canvas.width  / 2;
    const mouseY  = e.offsetY - canvas.height / 2;
    view.x -= (mouseX - view.x) * (newZoom / view.zoom - 1);
    view.y -= (mouseY - view.y) * (newZoom / view.zoom - 1);
    view.zoom = newZoom;
    instance.draw();
  });

  /* ── MOUSE: CLICK / DRAG ── */
  canvas.addEventListener('mousedown', (e) => {
    const mx = e.offsetX, my = e.offsetY;
    let hit = -1;
    for (let i = waypointsRendered.length - 1; i >= 0; i--) {
      const wp = waypointsRendered[i];
      if (Math.hypot(wp.x - mx, wp.y - my) < 15) { hit = wp.i; break; }
    }

    if (hit !== -1) {
      // Waypoint clicked — update inspector panel
      activeWpIndex = hit;
      if (window.Inspector) window.Inspector.select(hit);
      instance.draw();
    } else {
      view.dragging = true;
      view.startX   = e.clientX - view.x;
      view.startY   = e.clientY - view.y;
      activeWpIndex = -1;
      if (window.Inspector) window.Inspector.select(-1);
      instance.draw();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (view.dragging) {
      view.x = e.clientX - view.startX;
      view.y = e.clientY - view.startY;
      instance.draw();
    }
  });

  window.addEventListener('mouseup', () => { view.dragging = false; });

  return instance;
};
