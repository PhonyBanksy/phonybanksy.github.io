import { toAngle, toQuaternion } from './math-utils.js';

export function MapVisualizer(canvasContainerId = 'routeCanvas', outputFieldId = 'output') {
    const container = document.getElementById(canvasContainerId);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    // Map Loading Refs
    const mapInput = document.getElementById('mapUpload');
    const btnLoadMap = document.getElementById('btnLoadMap');
    const statusText = document.getElementById('mapStatus');

    // Config
    const mapConfig = {
        width: 4000,
        height: 4000,
        gameOffsetX: 2381,
        gameOffsetY: 574,
        scale: 0.002
    };

    let mapImage = new Image();
    let mapLoaded = false;

    // State
    let view = { x: 0, y: 0, zoom: 0.5, dragging: false, startX: 0, startY: 0 };
    let waypointsRendered = [];
    let activeWpIndex = -1;

	const setupMapLoading = () => {
    mapImage.onload = () => {
        mapLoaded = true;
        statusText.textContent = "Map Loaded (map.jpg)";
        statusText.style.color = "#4caf50";
        console.log('✓ Map loaded successfully from:', mapImage.src);
        draw();
    };
    mapImage.onerror = () => {
        mapLoaded = false;
        statusText.textContent = "Auto-load failed. Select map manually.";
        statusText.style.color = "#ff9800";
        console.error('✗ Failed to load map from:', mapImage.src);
        draw();
    };
    console.log('Attempting to load map from: map.jpg');
    mapImage.src = 'map.jpg';
    
	// --- MAP LOADING ---
    const setupMapLoading = () => {
        mapImage.onload = () => {
            mapLoaded = true;
            statusText.textContent = "Map Loaded (map.jpg)";
            statusText.style.color = "#4caf50";
            draw();
        };
        mapImage.onerror = () => {
            mapLoaded = false;
            statusText.textContent = "Auto-load failed. Select map manually.";
            statusText.style.color = "#ff9800";
            draw();
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
                        draw();
                    };
                    mapImage.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    };

    // --- COORDINATE CONVERSION ---
    const gameToScreen = (gx, gy) => {
        let mx = (gx * mapConfig.scale * 0.93) + mapConfig.gameOffsetX;
        let my = (gy * mapConfig.scale * 0.93) + mapConfig.gameOffsetY;
        mx -= mapConfig.width / 2;
        my -= mapConfig.height / 2;

        const sx = (mx * view.zoom) + view.x + canvas.width / 2;
        const sy = (my * view.zoom) + view.y + canvas.height / 2;
        return { x: sx, y: sy };
    };

    // --- DRAWING ---
    const draw = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2 + view.x, canvas.height / 2 + view.y);
        ctx.scale(view.zoom, view.zoom);
        
        if (mapLoaded) {
            ctx.drawImage(mapImage, -mapConfig.width / 2, -mapConfig.height / 2);
        } else {
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 10;
            ctx.strokeRect(-mapConfig.width / 2, -mapConfig.height / 2, mapConfig.width, mapConfig.height);
            ctx.fillStyle = '#fff';
            ctx.font = '50px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Map not loaded", 0, 0);
        }
        ctx.restore();

        const data = getRouteData();
        waypointsRendered = [];
        
        if (!data || !data.waypoints) return;

        // Draw Connections
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.waypoints.forEach((wp, i) => {
            const pos = gameToScreen(wp.translation.x, wp.translation.y);
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();

        // Draw Waypoints
        data.waypoints.forEach((wp, i) => {
            const pos = gameToScreen(wp.translation.x, wp.translation.y);
            const isSelected = (i === activeWpIndex);
            
            waypointsRendered.push({ i, x: pos.x, y: pos.y, r: 10 });

            // 1. Rotation Line (Gate Width visualization)
            const angle = toAngle(wp.rotation);
            const rad = angle * (Math.PI / 180);
            const gateLen = 30 * view.zoom;
            const dx = Math.cos(rad) * gateLen;
            const dy = Math.sin(rad) * gateLen;

            ctx.beginPath();
            ctx.moveTo(pos.x - dx, pos.y - dy);
            ctx.lineTo(pos.x + dx, pos.y + dy);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 2. Dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#ffff00' : '#00bfff';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 3. Text Labels
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`#${i}`, pos.x + 8, pos.y - 8);

            if (i === 0) {
                ctx.fillStyle = '#4caf50';
                ctx.font = 'bold 14px Arial';
                ctx.fillText("START", pos.x + 8, pos.y + 15);
            } else if (i === data.waypoints.length - 1) {
                ctx.fillStyle = '#ff4d4d';
                ctx.font = 'bold 14px Arial';
                ctx.fillText("FINISH", pos.x + 8, pos.y + 15);
            }
        });
    };

    // --- DATA ACCESS ---
    const getRouteData = () => {
        try { 
            return JSON.parse(document.getElementById(outputFieldId).value); 
        } catch (e) { 
            return null; 
        }
    };

    const saveRouteData = (data) => {
        const str = JSON.stringify(data, null, 2);
        document.getElementById(outputFieldId).value = str;
        document.getElementById('json_data').value = str;
    };

    // --- CANVAS INTERACTION ---
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomSpeed;
        const newZoom = Math.max(0.05, Math.min(view.zoom + delta, 5));

        const mouseX = e.offsetX - canvas.width / 2;
        const mouseY = e.offsetY - canvas.height / 2;

        view.x -= (mouseX - view.x) * (newZoom / view.zoom - 1);
        view.y -= (mouseY - view.y) * (newZoom / view.zoom - 1);

        view.zoom = newZoom;
        draw();
    });

    canvas.addEventListener('mousedown', (e) => {
        const mx = e.offsetX, my = e.offsetY;
        let hit = -1;
        for (let i = waypointsRendered.length - 1; i >= 0; i--) {
            const wp = waypointsRendered[i];
            const dist = Math.hypot(wp.x - mx, wp.y - my);
            if (dist < 15) { 
                hit = wp.i; 
                break; 
            }
        }

        if (hit !== -1) {
            setActiveWaypoint(hit);
        } else {
            view.dragging = true;
            view.startX = e.clientX - view.x;
            view.startY = e.clientY - view.y;
            activeWpIndex = -1;
            draw();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (view.dragging) {
            view.x = e.clientX - view.startX;
            view.y = e.clientY - view.startY;
            draw();
        }
    });

    window.addEventListener('mouseup', () => { 
        view.dragging = false; 
    });

    // --- PUBLIC INTERFACE ---
    const setActiveWaypoint = (index) => {
        activeWpIndex = index;
        draw();
    };

    const getActiveWaypoint = () => activeWpIndex;

    const getWaypointsRendered = () => waypointsRendered;

    setupMapLoading();

    return {
        draw,
        loadFromOutput: () => { 
            const data = getRouteData();
            if (data && data.waypoints && data.waypoints.length > 0) {
                view.x = 0;
                view.y = 0;
                view.zoom = 0.5;
            }
            draw();
        },
        getRouteData,
        saveRouteData,
        setActiveWaypoint,
        getActiveWaypoint,
        getWaypointsRendered,
        getMapConfig: () => mapConfig,
        toAngle,
        toQuaternion
    };
}