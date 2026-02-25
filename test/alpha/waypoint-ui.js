// REMOVED 'export' keyword to fix syntax error
function setupWaypointUI(visualizer) {
    const menu = document.getElementById('wpContext');
    const inpW = document.getElementById('inpWidth');
    const inpH = document.getElementById('inpHeight');
    const inpD = document.getElementById('inpDepth');
    const rotateDisplay = document.getElementById('rotateVal');
    const rotSlider = document.getElementById('rotSlider');

window.openWaypointMenu = (index) => {
        visualizer.setActiveWaypoint(index);
        const wpMeta = visualizer.getWaypointsRendered().find(w => w.i === index);
        if (!wpMeta) return;

        menu.style.display = 'block';
        menu.style.left = (wpMeta.x + 15) + 'px';
        menu.style.top = (wpMeta.y - 15) + 'px';
        
        const data = visualizer.getRouteData();
        const wp = data.waypoints[index];
        const s = wp.scale3D || { x: 1, y: 10, z: 1 };
        
        // Sync inputs with waypoint data
        inpW.value = s.y; 
        inpH.value = s.x; 
        inpD.value = s.z;
        
        const angle = Math.round(visualizer.toAngle(wp.rotationQuat || { x:0, y:0, z:0, w:1 }));
        rotSlider.value = angle;
        rotateDisplay.textContent = angle + '°';
    };

    // Close menu when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (menu && !menu.contains(e.target) && !e.target.classList.contains('wp-node')) {
            menu.style.display = 'none';
        }
    });
    document.getElementById('btnOptAdjust').onclick = () => {
        document.getElementById('wpMainOpts').style.display = 'none';
        document.getElementById('wpAdjustPanel').style.display = 'block';
    };
    document.getElementById('btnBackAdjust').onclick = () => {
        document.getElementById('wpAdjustPanel').style.display = 'none';
        document.getElementById('wpMainOpts').style.display = 'flex';
    };

    const updateDims = () => {
        const idx = visualizer.getActiveWaypoint();
        if (idx === -1) return;
        const data = visualizer.getRouteData();
        data.waypoints[idx].scale3D = {
            y: parseFloat(inpW.value),
            x: parseFloat(inpH.value),
            z: parseFloat(inpD.value)
        };
        visualizer.saveRouteData(data);
    };

    inpW.oninput = updateDims;
    inpH.oninput = updateDims;
    inpD.oninput = updateDims;
}