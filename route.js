document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('routeCanvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // UI Elements
    const menu = document.getElementById('wpContext');
    const menuTitle = document.getElementById('wpTitle');
    const panelMain = document.getElementById('wpMainOpts');
    const panelAdjust = document.getElementById('wpAdjustPanel');
    const panelRotate = document.getElementById('wpRotatePanel');
    const rotHandle = document.getElementById('rotationHandle');
    
    // Inputs
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');

    // Config
    const imageConfig = {
        naturalWidth: 4000,
        naturalHeight: 4000,
        imageOffsetX: 2381,
        imageOffsetY: 574,
        gameToImageScale: 0.002,
        flipY: false,
        offsetX: 0,
        offsetY: 0,
        scaleFactor: 0.93
    };

    const mapImage = new Image();
    mapImage.src = 'map.jpg';

    let viewState = {
        panX: canvas.width / 2,
        panY: canvas.height / 2,
        scale: 1,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        hasFitView: false
    };

    let renderedWaypoints = [];
    let selectedWaypointIndex = -1;
    let isRotating = false;
    let isDraggingHandle = false;

    // --- SETUP ---
    const updateCanvasSize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    updateCanvasSize();
    container.appendChild(canvas);

    // --- MATH HELPERS ---
    const gameToImageX = (gameX) => 
        (gameX * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetX + 
        imageConfig.offsetX -
        imageConfig.naturalWidth / 2;

    const gameToImageY = (gameY) => 
        (imageConfig.flipY ? -1 : 1) * (gameY * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetY + 
        imageConfig.offsetY -
        imageConfig.naturalHeight / 2;

    // --- NEW ROTATION LOGIC (Z-Axis / 2D Plane) ---
    // User provided: z and w have values. This is rotation around Z-axis.
    // Angle = 2 * atan2(z, w)
    const getAngleFromQuaternion = (q) => {
        if (!q) return 0;
        // Calculate angle in radians
        const rad = 2 * Math.atan2(q.z, q.w);
        // Convert to degrees
        return rad * (180 / Math.PI);
    };

    const getQuaternionFromAngle = (degrees) => {
        const rad = degrees * (Math.PI / 180);
        // Half angle for quaternion calculation
        const halfRad = rad / 2;
        return {
            x: 0,
            y: 0,
            z: Math.sin(halfRad),
            w: Math.cos(halfRad)
        };
    };

    // --- DRAWING ---
    const drawWaypoints = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const waypoints = parseWaypoints();
        renderedWaypoints = []; 

        if (!mapImage.complete) return;

        fitWaypointsInView(waypoints);

        ctx.save();
        ctx.translate(viewState.panX, viewState.panY);
        ctx.scale(viewState.scale, viewState.scale);

        ctx.drawImage(mapImage, -imageConfig.naturalWidth/2, -imageConfig.naturalHeight/2, imageConfig.naturalWidth, imageConfig.naturalHeight);

        waypoints.forEach((wp, index) => {
            const x = gameToImageX(wp.translation.x);
            const y = gameToImageY(wp.translation.y);
            const radius = 5 / viewState.scale;

            // Save screen coordinates for clicking
            const screenX = (x * viewState.scale) + viewState.panX;
            const screenY = (y * viewState.scale) + viewState.panY;
            
            renderedWaypoints.push({
                index: index,
                gx: x, gy: y,
                sx: screenX, sy: screenY,
                r: radius * 2
            });

            // Draw Lines between waypoints
            if (index > 0) {
                const prev = waypoints[index - 1];
                ctx.beginPath();
                ctx.moveTo(gameToImageX(prev.translation.x), gameToImageY(prev.translation.y));
                ctx.lineTo(x, y);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2 / viewState.scale;
                ctx.stroke();
            }

            // Draw Rotation Direction
            if (wp.rotation) {
                const angleDeg = getAngleFromQuaternion(wp.rotation);
                const angleRad = angleDeg * (Math.PI / 180);
                
                // Length of the direction line
                const lineLen = 20 / viewState.scale;
                
                // Calculate "Width" direction (Perpendicular to forward?)
                // Usually in these editors, the rotation defines the "Forward" or the "Gate Plane".
                // Let's draw a line representing the rotation angle directly.
                // Note: Canvas Y is Down. If Game Y is Up, we flip sin.
                // Assuming standard 2D rotation mapping for now.
                
                const dx = Math.cos(angleRad) * lineLen;
                const dy = Math.sin(angleRad) * lineLen; 

                ctx.beginPath();
                ctx.moveTo(x - dx, y - dy); 
                ctx.lineTo(x + dx, y + dy);
                ctx.strokeStyle = '#00ff00'; // Green = Rotation
                ctx.lineWidth = 3 / viewState.scale;
                ctx.stroke();
            }

            // Draw Dot
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = (index === selectedWaypointIndex) ? '#ffff00' : '#00f';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / viewState.scale;
            ctx.stroke();

            // Labels
            if (index === 0 || index === waypoints.length - 1) {
                ctx.fillStyle = '#fff';
                ctx.font = `${16 / viewState.scale}px Arial bold`;
                const label = index === 0 ? 'START' : 'FINISH';
                ctx.fillText(label, x + 10 / viewState.scale, y - 10 / viewState.scale);
            }
        });

        ctx.restore();
        
        // Update Rotation Bubble Position (Screen Space)
        if (isRotating && selectedWaypointIndex !== -1) {
            updateRotationHandlePosition();
        }
    };

    // --- INTERACTION ---

    canvas.addEventListener('wheel', (e) => {
        // Zoom logic
        const zoomFactor = 1.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const zoom = direction > 0 ? zoomFactor : 1 / zoomFactor;
        const newScale = viewState.scale * zoom;
        if (newScale > 0.1 && newScale < 10) {
            viewState.panX = e.offsetX - (e.offsetX - viewState.panX) * zoom;
            viewState.panY = e.offsetY - (e.offsetY - viewState.panY) * zoom;
            viewState.scale = newScale;
            drawWaypoints();
            if(menu.style.display !== 'none') closeMenu();
        }
        viewState.hasFitView = true;
        e.preventDefault();
    });

    canvas.addEventListener('mousedown', (e) => {
        const clickX = e.offsetX;
        const clickY = e.offsetY;
        let clickedIndex = -1;

        // Hit test
        for (let i = renderedWaypoints.length - 1; i >= 0; i--) {
            const wp = renderedWaypoints[i];
            const dist = Math.sqrt((clickX - wp.sx) ** 2 + (clickY - wp.sy) ** 2);
            if (dist < Math.max(wp.r, 15)) { // 15px hit radius
                clickedIndex = wp.index;
                break;
            }
        }

        if (clickedIndex !== -1) {
            e.stopPropagation();
            selectWaypoint(clickedIndex);
        } else {
            viewState.isDragging = true;
            viewState.dragStartX = e.clientX - viewState.panX;
            viewState.dragStartY = e.clientY - viewState.panY;
            if (selectedWaypointIndex !== -1 && !isRotating) {
                selectedWaypointIndex = -1;
                closeMenu();
                drawWaypoints();
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (viewState.isDragging) {
            viewState.panX = e.clientX - viewState.dragStartX;
            viewState.panY = e.clientY - viewState.dragStartY;
            drawWaypoints();
            if(menu.style.display !== 'none') closeMenu();
        }
    });

    ['mouseup', 'mouseleave'].forEach(event => 
        canvas.addEventListener(event, () => {
            viewState.isDragging = false;
        })
    );

    // --- HANDLE DRAGGING ---
    
    rotHandle.addEventListener('mousedown', (e) => {
        isDraggingHandle = true;
        e.stopPropagation(); // Stop canvas drag
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingHandle && selectedWaypointIndex !== -1) {
            const wpMeta = renderedWaypoints.find(w => w.index === selectedWaypointIndex);
            if (!wpMeta) return;

            // Calculate angle based on mouse position relative to waypoint center (screen space)
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const dx = mouseX - wpMeta.sx;
            const dy = mouseY - wpMeta.sy;

            // Calculate degrees
            let angleRad = Math.atan2(dy, dx);
            let angleDeg = angleRad * (180 / Math.PI);
            
            document.getElementById('rotateVal').textContent = Math.round(angleDeg);
            updateWaypointRotation(selectedWaypointIndex, angleDeg);
            drawWaypoints(); // Redraw line
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingHandle = false;
    });

    // --- LOGIC ---

    const parseWaypoints = () => {
        try {
            const val = document.getElementById('output').value;
            return val ? JSON.parse(val).waypoints || [] : [];
        } catch (e) { return []; }
    };
    
    const getFullData = () => {
        try { return JSON.parse(document.getElementById('output').value); } catch(e){ return null; }
    };
    
    const saveFullData = (data) => {
        const str = JSON.stringify(data, null, 2);
        document.getElementById('output').value = str;
        document.getElementById('json_data').value = str;
    };

    const fitWaypointsInView = (waypoints) => {
        if (waypoints.length === 0 || viewState.hasFitView) return;
        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        waypoints.forEach(wp => {
            const x = gameToImageX(wp.translation.x);
            const y = gameToImageY(wp.translation.y);
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        });
        const padding = 50;
        minX-=padding; minY-=padding; maxX+=padding; maxY+=padding;
        const w = maxX-minX; const h = maxY-minY;
        const sX = canvas.width/w; const sY = canvas.height/h;
        viewState.scale = Math.min(sX, sY) * 0.9;
        viewState.panX = canvas.width/2 - ((minX+maxX)/2)*viewState.scale;
        viewState.panY = canvas.height/2 - ((minY+maxY)/2)*viewState.scale;
    };

    // --- MENU SYSTEM ---

    const selectWaypoint = (index) => {
        selectedWaypointIndex = index;
        const wpMeta = renderedWaypoints.find(w => w.index === index);
        
        drawWaypoints(); // Highlight

        const data = getFullData();
        const wp = data.waypoints[index];

        menuTitle.textContent = `Waypoint #${index}`;

        // Fill Inputs
        const scale = wp.scale3D || {x:0, y:0, z:0};
        inpW.value = scale.y; // Width
        inpH.value = scale.x; // Height
        inpD.value = scale.z; // Depth

        // Position Menu NEXT to the waypoint
        menu.style.display = 'block';
        if (wpMeta) {
            menu.style.left = (wpMeta.sx + 20) + 'px';
            menu.style.top = (wpMeta.sy - 20) + 'px';
        }

        showMainOpts();
        rotHandle.style.display = 'none';
        isRotating = false;
    };

    const closeMenu = () => {
        menu.style.display = 'none';
        rotHandle.style.display = 'none';
        isRotating = false;
    };

    const showMainOpts = () => {
        panelMain.style.display = 'flex';
        panelAdjust.style.display = 'none';
        panelRotate.style.display = 'none';
    };

    document.getElementById('btnOptAdjust').onclick = () => {
        panelMain.style.display = 'none';
        panelAdjust.style.display = 'flex';
    };

    document.getElementById('btnOptRotate').onclick = () => {
        panelMain.style.display = 'none';
        panelRotate.style.display = 'block';
        isRotating = true;
        
        const data = getFullData();
        const wp = data.waypoints[selectedWaypointIndex];
        const angle = getAngleFromQuaternion(wp.rotation);
        document.getElementById('rotateVal').textContent = Math.round(angle);
        
        rotHandle.style.display = 'block';
        updateRotationHandlePosition();
    };

    document.getElementById('btnBackAdjust').onclick = showMainOpts;
    document.getElementById('btnBackRotate').onclick = () => {
        showMainOpts();
        rotHandle.style.display = 'none';
        isRotating = false;
    };

    const updateDims = () => {
        if (selectedWaypointIndex === -1) return;
        const data = getFullData();
        if(!data.waypoints[selectedWaypointIndex].scale3D) data.waypoints[selectedWaypointIndex].scale3D = {x:0,y:0,z:0};
        
        data.waypoints[selectedWaypointIndex].scale3D.y = parseFloat(inpW.value) || 0;
        data.waypoints[selectedWaypointIndex].scale3D.x = parseFloat(inpH.value) || 0;
        data.waypoints[selectedWaypointIndex].scale3D.z = parseFloat(inpD.value) || 0;
        
        saveFullData(data);
        drawWaypoints();
    };
    inpW.onchange = updateDims;
    inpH.onchange = updateDims;
    inpD.onchange = updateDims;

    function updateWaypointRotation(index, degrees) {
        const data = getFullData();
        data.waypoints[index].rotation = getQuaternionFromAngle(degrees);
        saveFullData(data);
    }

    function updateRotationHandlePosition() {
        const wpMeta = renderedWaypoints.find(w => w.index === selectedWaypointIndex);
        if (!wpMeta) return;

        const data = getFullData();
        const wp = data.waypoints[selectedWaypointIndex];
        const angleDeg = getAngleFromQuaternion(wp.rotation);
        const angleRad = angleDeg * (Math.PI / 180);

        const dist = 60; // Distance from center
        
        // Calculate handle position
        const handleX = wpMeta.sx + Math.cos(angleRad) * dist;
        const handleY = wpMeta.sy + Math.sin(angleRad) * dist;

        rotHandle.style.left = (handleX - 10) + 'px'; // -10 for centering (20px width)
        rotHandle.style.top = (handleY - 10) + 'px';
    }

    // Init
    mapImage.addEventListener('load', drawWaypoints);
    window.addEventListener('resize', () => { updateCanvasSize(); drawWaypoints(); });
    document.getElementById('visualizeBtn').onclick = () => { viewState.hasFitView=false; drawWaypoints(); };
});