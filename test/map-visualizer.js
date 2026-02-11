window.MapVisualizer = function(canvasContainerId = 'routeCanvas', outputFieldId = 'output') {
    const container = document.getElementById(canvasContainerId);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    // UI References (for Context Menu)
    const menu = document.getElementById('wpContext');
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');
    const rotateDisplay = document.getElementById('rotateVal');
    const rotSlider = document.getElementById('rotSlider');

    // Map Loading References
    const mapInput = document.getElementById('mapUpload');
    const btnLoadMap = document.getElementById('btnLoadMap');
    const statusText = document.getElementById('mapStatus');

    // Configuration
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

    // --- MATH HELPERS ---
    const toAngle = (q) => {
        if (!q) return 0;
        return (2 * Math.atan2(q.z, q.w)) * (180 / Math.PI);
    };

    const toQuat = (deg) => {
        const rad = deg * (Math.PI / 180);
        return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
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

    // --- INSTANCE DEFINITION ---
    const instance = {
        // Required by route-processor.js
        loadFromOutput: () => {
            instance.draw();
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

        draw: () => {
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

            const data = instance.getRouteData();
            waypointsRendered = [];

            if (!data || !data.waypoints) return;

            // 1. Draw Connections
            ctx.lineWidth = 2;
            ctx.beginPath();
            data.waypoints.forEach((wp, i) => {
                const pos = gameToScreen(wp.translation.x, wp.translation.y);
                if (i === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.stroke();

            // 2. Draw Waypoints
            data.waypoints.forEach((wp, i) => {
                const pos = gameToScreen(wp.translation.x, wp.translation.y);
                const isSelected = (i === activeWpIndex);

                waypointsRendered.push({ i, x: pos.x, y: pos.y });

                // -- Rotation Line (Gate Width) with 90 Degree Offset --
                const angle = toAngle(wp.rotation);
                // FIXED: Added +90 degrees offset for correct visualization
                const rad = (angle + 90) * (Math.PI / 180); 
                
                const gateLen = 30 * view.zoom; 
                const dx = Math.cos(rad) * gateLen;
                const dy = Math.sin(rad) * gateLen;

                ctx.beginPath();
                ctx.moveTo(pos.x - dx, pos.y - dy);
                ctx.lineTo(pos.x + dx, pos.y + dy);
                ctx.strokeStyle = '#00ff00'; 
                ctx.lineWidth = 3;
                ctx.stroke();

                // -- Dot --
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? '#ffff00' : '#00bfff';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();

                // -- Labels (Index, Start, Finish) --
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
        }
    };

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

    // --- MOUSE INTERACTIONS ---
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomSpeed;
        const newZoom = Math.max(0.05, Math.min(view.zoom + delta, 5));
        
        // Zoom toward mouse pointer
        const mouseX = e.offsetX - canvas.width / 2;
        const mouseY = e.offsetY - canvas.height / 2;
        view.x -= (mouseX - view.x) * (newZoom / view.zoom - 1);
        view.y -= (mouseY - view.y) * (newZoom / view.zoom - 1);
        
        view.zoom = newZoom;
        instance.draw();
        if (window.closeMenu) window.closeMenu();
    });

    canvas.addEventListener('mousedown', (e) => {
        const mx = e.offsetX, my = e.offsetY;
        let hit = -1;
        for (let i = waypointsRendered.length - 1; i >= 0; i--) {
            const wp = waypointsRendered[i];
            if (Math.hypot(wp.x - mx, wp.y - my) < 15) { hit = wp.i; break; }
        }

        if (hit !== -1) {
            openMenu(hit);
        } else {
            view.dragging = true;
            view.startX = e.clientX - view.x;
            view.startY = e.clientY - view.y;
            closeMenu();
            activeWpIndex = -1;
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

    // --- CONTEXT MENU LOGIC ---
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

        const data = instance.getRouteData();
        const wp = data.waypoints[index];
        const s = wp.scale3D || { x: 1, y: 10, z: 1 };
        inpW.value = s.y; 
        inpH.value = s.x; 
        inpD.value = s.z;
        
        const angle = Math.round(toAngle(wp.rotation));
        rotSlider.value = angle;
        rotateDisplay.textContent = angle;
        
        instance.draw();
    }

    function closeMenu() {
        if (menu) menu.style.display = 'none';
    }
    // Expose closeMenu globally for external calls if needed
    window.closeMenu = closeMenu;

    // --- BINDING MENU BUTTONS ---
    // Note: These IDs must exist in index.html
    const bindIf = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    
    bindIf('btnOptAdjust', () => {
        document.getElementById('wpMainOpts').style.display = 'none';
        document.getElementById('wpAdjustPanel').style.display = 'block';
    });
    bindIf('btnOptRotate', () => {
        document.getElementById('wpMainOpts').style.display = 'none';
        document.getElementById('wpRotatePanel').style.display = 'block';
    });
    bindIf('btnBackAdjust', () => {
        document.getElementById('wpAdjustPanel').style.display = 'none';
        document.getElementById('wpMainOpts').style.display = 'flex';
    });
    bindIf('btnBackRotate', () => {
        document.getElementById('wpRotatePanel').style.display = 'none';
        document.getElementById('wpMainOpts').style.display = 'flex';
    });

    // --- INPUT UPDATES ---
    const updateDims = () => {
        if (activeWpIndex === -1) return;
        const data = instance.getRouteData();
        if (!data.waypoints[activeWpIndex].scale3D) data.waypoints[activeWpIndex].scale3D = {};
        
        data.waypoints[activeWpIndex].scale3D.y = parseFloat(inpW.value) || 0;
        data.waypoints[activeWpIndex].scale3D.x = parseFloat(inpH.value) || 0;
        data.waypoints[activeWpIndex].scale3D.z = parseFloat(inpD.value) || 0;
        
        instance.saveRouteData(data);
    };
    if(inpW) inpW.oninput = updateDims;
    if(inpH) inpH.oninput = updateDims;
    if(inpD) inpD.oninput = updateDims;

    if(rotSlider) rotSlider.oninput = (e) => {
        if (activeWpIndex === -1) return;
        const deg = parseFloat(e.target.value);
        if(rotateDisplay) rotateDisplay.textContent = deg;
        
        const data = instance.getRouteData();
        data.waypoints[activeWpIndex].rotation = toQuat(deg);
        instance.saveRouteData(data);
        instance.draw();
    };

    setupMapLoading();
    return instance;
};