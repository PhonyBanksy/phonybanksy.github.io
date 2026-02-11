export function setupWaypointUI(visualizer) {
    // UI Refs
    const menu = document.getElementById('wpContext');
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');
    const rotateDisplay = document.getElementById('rotateVal');
    const rotSlider = document.getElementById('rotSlider');

    let isRotating = false;

    // --- MENU INTERACTION ---
    canvas.addEventListener('click', (e) => {
        // Close menu on canvas click (unless on waypoint)
        // Already handled by MapVisualizer
    });

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

    // --- WAYPOINT EDITING ---
    const updateDims = () => {
        const activeIndex = visualizer.getActiveWaypoint();
        if (activeIndex === -1) return;
        
        const data = visualizer.getRouteData();
        if (!data.waypoints[activeIndex].scale3D) {
            data.waypoints[activeIndex].scale3D = {};
        }
        
        data.waypoints[activeIndex].scale3D.y = parseFloat(inpW.value) || 0;
        data.waypoints[activeIndex].scale3D.x = parseFloat(inpH.value) || 0;
        data.waypoints[activeIndex].scale3D.z = parseFloat(inpD.value) || 0;
        
        visualizer.saveRouteData(data);
    };

    inpW.oninput = updateDims;
    inpH.oninput = updateDims;
    inpD.oninput = updateDims;

    // --- SLIDER ROTATION ---
    rotSlider.oninput = (e) => {
        const activeIndex = visualizer.getActiveWaypoint();
        if (activeIndex === -1) return;
        
        const deg = parseFloat(e.target.value);
        rotateDisplay.textContent = deg;
        
        const data = visualizer.getRouteData();
        data.waypoints[activeIndex].rotation = visualizer.toQuaternion(deg);
        visualizer.saveRouteData(data);
        visualizer.draw();
    };

    // --- OPEN WAYPOINT MENU ---
    window.openWaypointMenu = (index) => {
        visualizer.setActiveWaypoint(index);
        const wpMeta = visualizer.getWaypointsRendered().find(w => w.i === index);
        
        if (!wpMeta) return;

        menu.style.display = 'block';
        menu.style.left = (wpMeta.x + 15) + 'px';
        menu.style.top = (wpMeta.y - 15) + 'px';
        
        document.getElementById('wpTitle').textContent = `Waypoint #${index}`;
        document.getElementById('wpMainOpts').style.display = 'flex';
        document.getElementById('wpAdjustPanel').style.display = 'none';
        document.getElementById('wpRotatePanel').style.display = 'none';
        isRotating = false;

        const data = visualizer.getRouteData();
        const wp = data.waypoints[index];
        const s = wp.scale3D || { x: 1, y: 1, z: 1 };
        inpW.value = s.y;
        inpH.value = s.x;
        inpD.value = s.z;
        
        const angle = Math.round(visualizer.toAngle(wp.rotation));
        rotSlider.value = angle;
        rotateDisplay.textContent = angle;

        visualizer.draw();
    };

    // --- CLOSE MENU ---
    window.closeMenu = () => {
        menu.style.display = 'none';
        isRotating = false;
    };
}