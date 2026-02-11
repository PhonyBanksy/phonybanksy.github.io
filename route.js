document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('routeCanvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    // UI Refs
    const menu = document.getElementById('wpContext');
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');
    const rotateDisplay = document.getElementById('rotateVal');
    const rotSlider = document.getElementById('rotSlider');
    
    // Map Loading Refs
    const mapInput = document.getElementById('mapUpload');
    const btnLoadMap = document.getElementById('btnLoadMap');
    const statusText = document.getElementById('mapStatus');

    // Config
    const mapConfig = {
        width: 4000, height: 4000,
        gameOffsetX: 2381, gameOffsetY: 574,
        scale: 0.002
    };

    let mapImage = new Image();
    let mapLoaded = false;

    // State
    let view = { x: 0, y: 0, zoom: 0.5, dragging: false, startX: 0, startY: 0 };
    let waypointsRendered = [];
    let activeWpIndex = -1;
    let isRotating = false;

    // --- MAP LOADING ---
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

    // --- MATH ---
    const toAngle = (q) => {
        if (!q) return 0;
        return (2 * Math.atan2(q.z, q.w)) * (180 / Math.PI);
    };
    
    const toQuat = (deg) => {
        const rad = deg * (Math.PI / 180);
        return { x:0, y:0, z: Math.sin(rad/2), w: Math.cos(rad/2) };
    };

    const gameToScreen = (gx, gy) => {
        let mx = (gx * mapConfig.scale * 0.93) + mapConfig.gameOffsetX;
        let my = (gy * mapConfig.scale * 0.93) + mapConfig.gameOffsetY;
        mx -= mapConfig.width/2; 
        my -= mapConfig.height/2;

        const sx = (mx * view.zoom) + view.x + canvas.width/2;
        const sy = (my * view.zoom) + view.y + canvas.height/2;
        return { x: sx, y: sy };
    };

    // --- DRAWING ---
    const draw = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width/2 + view.x, canvas.height/2 + view.y);
        ctx.scale(view.zoom, view.zoom);
        
        if (mapLoaded) {
            ctx.drawImage(mapImage, -mapConfig.width/2, -mapConfig.height/2);
        } else {
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 10;
            ctx.strokeRect(-mapConfig.width/2, -mapConfig.height/2, mapConfig.width, mapConfig.height);
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
            // Draws a line crossing the waypoint perpendicular to the track (roughly) or based on rotation
            const angle = toAngle(wp.rotation);
            const rad = angle * (Math.PI / 180);
            
            // Visual width of the gate line
            const gateLen = 30 * view.zoom; 
            
            const dx = Math.cos(rad) * gateLen;
            const dy = Math.sin(rad) * gateLen;

            ctx.beginPath();
            ctx.moveTo(pos.x - dx, pos.y - dy);
            ctx.lineTo(pos.x + dx, pos.y + dy);
            ctx.strokeStyle = '#00ff00'; // Green gate line
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

            // 3. Text Labels (Start/Finish/Index)
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            
            // Draw Index Number slightly offset
            ctx.fillText(`#${i}`, pos.x + 8, pos.y - 8);

            // Draw START / FINISH
            if (i === 0) {
                ctx.fillStyle = '#4caf50'; // Green for Start
                ctx.font = 'bold 14px Arial';
                ctx.fillText("START", pos.x + 8, pos.y + 15);
            } else if (i === data.waypoints.length - 1) {
                ctx.fillStyle = '#ff4d4d'; // Red for Finish
                ctx.font = 'bold 14px Arial';
                ctx.fillText("FINISH", pos.x + 8, pos.y + 15);
            }
        });
    };

    const getRouteData = () => {
        try { return JSON.parse(document.getElementById('output').value); }
        catch (e) { return null; }
    };

    const saveRouteData = (data) => {
        const str = JSON.stringify(data, null, 2);
        document.getElementById('output').value = str;
        document.getElementById('json_data').value = str;
    };

    // --- INTERACTION ---
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomSpeed;
        const newZoom = Math.max(0.05, Math.min(view.zoom + delta, 5));
        view.zoom = newZoom;
        draw();
        closeMenu();
    });

    canvas.addEventListener('mousedown', (e) => {
        const mx = e.offsetX, my = e.offsetY;
        let hit = -1;
        // Hit test top-most first
        for (let i = waypointsRendered.length - 1; i >= 0; i--) {
            const wp = waypointsRendered[i];
            const dist = Math.hypot(wp.x - mx, wp.y - my);
            if (dist < 15) { hit = wp.i; break; }
        }

        if (hit !== -1) {
            openMenu(hit);
        } else {
            view.dragging = true;
            view.startX = e.clientX - view.x;
            view.startY = e.clientY - view.y;
            closeMenu();
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

    window.addEventListener('mouseup', () => { view.dragging = false; });

    function openMenu(index) {
        activeWpIndex = index;
        const wpMeta = waypointsRendered.find(w => w.i === index);
        
        menu.style.display = 'block';
        menu.style.left = (wpMeta.x + 15) + 'px';
        menu.style.top = (wpMeta.y - 15) + 'px';
        
        document.getElementById('wpTitle').textContent = `Waypoint #${index}`;
        document.getElementById('wpMainOpts').style.display = 'flex';
        document.getElementById('wpAdjustPanel').style.display = 'none';
        document.getElementById('wpRotatePanel').style.display = 'none';
        isRotating = false;

        const data = getRouteData();
        const wp = data.waypoints[index];
        const s = wp.scale3D || {x:1, y:1, z:1};
        inpW.value = s.y; inpH.value = s.x; inpD.value = s.z;
        
        // Init Slider
        const angle = Math.round(toAngle(wp.rotation));
        rotSlider.value = angle;
        rotateDisplay.textContent = angle;

        draw(); 
    }

    window.closeMenu = () => {
        menu.style.display = 'none';
        isRotating = false;
    };

    // --- SUBMENUS ---
    document.getElementById('btnOptAdjust').onclick = () => {
        document.getElementById('wpMainOpts').style.display = 'none';
        document.getElementById('wpAdjustPanel').style.display = 'block';
    };
    
    document.getElementById('btnOptRotate').onclick = () => {
        document.getElementById('wpMainOpts').style.display = 'none';
        document.getElementById('wpRotatePanel').style.display = 'block';
        isRotating = true;
    };

    document.getElementById('btnBackAdjust').onclick = () => {
        document.getElementById('wpAdjustPanel').style.display = 'none';
        document.getElementById('wpMainOpts').style.display = 'flex';
    };
    document.getElementById('btnBackRotate').onclick = () => {
        document.getElementById('wpRotatePanel').style.display = 'none';
        document.getElementById('wpMainOpts').style.display = 'flex';
        isRotating = false;
    };

    // --- DATA UPDATES ---
    const updateDims = () => {
        if (activeWpIndex === -1) return;
        const data = getRouteData();
        if (!data.waypoints[activeWpIndex].scale3D) data.waypoints[activeWpIndex].scale3D = {};
        data.waypoints[activeWpIndex].scale3D.y = parseFloat(inpW.value) || 0;
        data.waypoints[activeWpIndex].scale3D.x = parseFloat(inpH.value) || 0;
        data.waypoints[activeWpIndex].scale3D.z = parseFloat(inpD.value) || 0;
        saveRouteData(data);
    };
    inpW.oninput = updateDims;
    inpH.oninput = updateDims;
    inpD.oninput = updateDims;

    // --- SLIDER ROTATION ---
    rotSlider.oninput = (e) => {
        if (activeWpIndex === -1) return;
        const deg = parseFloat(e.target.value);
        rotateDisplay.textContent = deg;
        
        const data = getRouteData();
        data.waypoints[activeWpIndex].rotation = toQuat(deg);
        saveRouteData(data);
        draw();
    };

    window.MapVisualizer = {
        loadFromOutput: () => { draw(); }
    };
});