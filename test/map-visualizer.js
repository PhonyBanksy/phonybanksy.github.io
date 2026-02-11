window.MapVisualizer = function(canvasContainerId = 'routeCanvas', outputFieldId = 'output') {
    const container = document.getElementById(canvasContainerId);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    const mapInput = document.getElementById('mapUpload');
    const btnLoadMap = document.getElementById('btnLoadMap');
    const statusText = document.getElementById('mapStatus');

    // State & Config
    const mapConfig = { width: 4000, height: 4000, gameOffsetX: 2381, gameOffsetY: 574, scale: 0.002 };
    let mapImage = new Image();
    let mapLoaded = false;
    let view = { x: 0, y: 0, zoom: 0.5, dragging: false, startX: 0, startY: 0 };
    let waypointsRendered = [];
    let activeWpIndex = -1;

    // --- MAP LOADING ---
    const setupMapLoading = () => {
        mapImage.onload = () => {
            mapLoaded = true;
            statusText.textContent = "Map Loaded (map.jpg)";
            statusText.style.color = "#4caf50";
            instance.draw();
        };
        mapImage.onerror = () => {
            mapLoaded = false;
            statusText.textContent = "Auto-load failed. Select map manually.";
            statusText.style.color = "#ff9800";
            instance.draw();
        };
        mapImage.src = 'map.jpg';

        btnLoadMap.onclick = () => mapInput.click();
        mapInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    mapImage = new Image();
                    mapImage.onload = () => {
                        mapLoaded = true;
                        statusText.textContent = "Custom Map Loaded";
                        statusText.style.color = "#4caf50";
                        instance.draw();
                    };
                    mapImage.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    };

    const gameToScreen = (gx, gy) => {
        let mx = (gx * mapConfig.scale * 0.93) + mapConfig.gameOffsetX;
        let my = (gy * mapConfig.scale * 0.93) + mapConfig.gameOffsetY;
        mx -= mapConfig.width / 2;
        my -= mapConfig.height / 2;
        return {
            x: (mx * view.zoom) + view.x + canvas.width / 2,
            y: (my * view.zoom) + view.y + canvas.height / 2
        };
    };

    // Create instance object to return
    const instance = {
        draw: () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2 + view.x, canvas.height / 2 + view.y);
            ctx.scale(view.zoom, view.zoom);
            if (mapLoaded) ctx.drawImage(mapImage, -mapConfig.width / 2, -mapConfig.height / 2);
            ctx.restore();

            const data = instance.getRouteData();
            waypointsRendered = [];
            if (!data || !data.waypoints) return;

            // Connections
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            data.waypoints.forEach((wp, i) => {
                const pos = gameToScreen(wp.translation.x, wp.translation.y);
                if (i === 0) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();

            // Waypoints
            data.waypoints.forEach((wp, i) => {
                const pos = gameToScreen(wp.translation.x, wp.translation.y);
                waypointsRendered.push({ i, x: pos.x, y: pos.y });
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = (i === activeWpIndex) ? '#ffff00' : '#00bfff';
                ctx.fill();
            });
        },
        getRouteData: () => {
            try { return JSON.parse(document.getElementById(outputFieldId).value); }
            catch (e) { return null; }
        },
        saveRouteData: (data) => {
            const str = JSON.stringify(data, null, 2);
            document.getElementById(outputFieldId).value = str;
            document.getElementById('json_data').value = str;
        },
        setActiveWaypoint: (idx) => { activeWpIndex = idx; instance.draw(); },
        getActiveWaypoint: () => activeWpIndex,
        getWaypointsRendered: () => waypointsRendered
    };

    // Interactions
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        view.zoom = Math.max(0.05, Math.min(view.zoom + (-Math.sign(e.deltaY) * 0.1), 5));
        instance.draw();
    });

    canvas.addEventListener('mousedown', (e) => {
        const mx = e.offsetX, my = e.offsetY;
        let hit = -1;
        for (let i = waypointsRendered.length - 1; i >= 0; i--) {
            if (Math.hypot(waypointsRendered[i].x - mx, waypointsRendered[i].y - my) < 15) {
                hit = waypointsRendered[i].i; break;
            }
        }
        if (hit !== -1) {
            if (window.openWaypointMenu) window.openWaypointMenu(hit);
        } else {
            view.dragging = true;
            view.startX = e.clientX - view.x;
            view.startY = e.clientY - view.y;
            activeWpIndex = -1;
            if (window.closeMenu) window.closeMenu();
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
    window.addEventListener('mouseup', () => view.dragging = false);

    setupMapLoading();
    return instance;
};