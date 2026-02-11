// --- Math Helpers ---
const MathUtils = {
    // Convert Quaternion {x,y,z,w} to Angle (Degrees) around Z-axis
    toAngle: (q) => {
        if (!q) return 0;
        // 2 * atan2(z, w) gives radians
        const rad = 2 * Math.atan2(q.z, q.w);
        let deg = rad * (180 / Math.PI);
        return deg; // Returns -180 to 180
    },

    // Convert Angle (Degrees) to Quaternion {x,y,z,w}
    toQuaternion: (degrees) => {
        const rad = degrees * (Math.PI / 180);
        return {
            x: 0,
            y: 0,
            z: Math.sin(rad / 2),
            w: Math.cos(rad / 2)
        };
    }
};

const RouteProcessor = {
    /**
     * Main processing function.
     */
    process() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        
        const scaleFactor = parseInt(document.getElementById('scale_mode').value) || 0;
        const rotationBatchAngle = parseFloat(document.getElementById('rotation_angle').value) || 0;
        const reverseChecked = document.getElementById('reverse').checked;
        const squareGates = document.getElementById('boxes').checked;
        
        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                // 1. Reverse Route
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                // 2. Process Waypoints
                data.waypoints.forEach(waypoint => {
                    // Ensure scale object exists
                    if (!waypoint.scale3D) waypoint.scale3D = { x: 1, y: 10, z: 1 };

                    // Apply Scale (Width/Y)
                    if (typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }

                    // Apply Square Box Logic (Depth = Width)
                    if (squareGates) {
                        waypoint.scale3D.z = waypoint.scale3D.y;
                    }

                    // Apply Rotation
                    // We must convert Q -> Angle -> Add Offset -> Q
                    let currentAngle = 0;
                    if (waypoint.rotation) {
                        currentAngle = MathUtils.toAngle(waypoint.rotation);
                    }
                    
                    const newAngle = currentAngle + rotationBatchAngle + 90;
                    waypoint.rotation = MathUtils.toQuaternion(newAngle);
                });

                // 3. Output
                const resultJson = JSON.stringify(data, null, 2);
                outputField.value = resultJson;

                // 4. Save
                let suffix = reverseChecked ? `(R) ` : '';
                if (scaleFactor > 0) suffix += `W+${scaleFactor} `;
                if (rotationBatchAngle !== 0) suffix += `Rot:${rotationBatchAngle}°`;
                
                const name = (data.routeName || "Unnamed") + ' ' + suffix;
                RouteProcessor.saveRouteToLocalStorage(name, data);
                
                // 5. Update Visualizer automatically
                if (window.MapVisualizer) {
                    window.MapVisualizer.loadFromOutput();
                }

            } else {
                outputField.value = 'Error: Input must contain a "waypoints" array.';
            }
        } catch (error) {
            outputField.value = 'JSON Parse Error: ' + error.message;
        }
    },

    saveRouteToLocalStorage(routeName, routeData) {
        try {
            let routes = JSON.parse(localStorage.getItem('routes')) || [];
            if (!Array.isArray(routes)) routes = [];
            
            // Allow duplicates, just append timestamp if needed, or simple check
            const exists = routes.find(r => r.routeName === routeName);
            if (!exists) {
                routes.push({ routeName, routeData });
                localStorage.setItem('routes', JSON.stringify(routes));
                RouteProcessor.updateRouteList();
            }
        } catch (error) {
            console.error("Save error:", error);
        }
    },

    updateRouteList() {
        const list = document.getElementById('routeList');
        let routes = JSON.parse(localStorage.getItem('routes')) || [];
        
        list.innerHTML = '';
        if (routes.length === 0) {
            list.innerHTML = '<li class="empty">No saved routes</li>';
            return;
        }

        routes.forEach((route, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="route-name">${route.routeName}</span>
                <span class="delete-route" title="Delete">×</span>
            `;
            
            // Load click
            li.querySelector('.route-name').onclick = () => {
                const str = JSON.stringify(route.routeData, null, 2);
                document.getElementById('json_data').value = str;
                document.getElementById('output').value = str;
                if (window.MapVisualizer) window.MapVisualizer.loadFromOutput();
            };

            // Delete click
            li.querySelector('.delete-route').onclick = (e) => {
                e.stopPropagation();
                RouteProcessor.deleteRoute(index);
            };

            list.appendChild(li);
        });
    },

    deleteRoute(index) {
        const routes = JSON.parse(localStorage.getItem('routes')) || [];
        routes.splice(index, 1);
        localStorage.setItem('routes', JSON.stringify(routes));
        RouteProcessor.updateRouteList();
    },

    exportAllRoutesAsZip() {
        const routes = JSON.parse(localStorage.getItem('routes')) || [];
        if (routes.length === 0) return alert('Nothing to export.');

        const zip = new JSZip();
        routes.forEach((r, i) => {
            const name = (r.routeName || `route_${i}`).replace(/[^a-z0-9]/gi, '_');
            zip.file(`${name}.json`, JSON.stringify(r.routeData, null, 2));
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'motortown_routes.zip';
            a.click();
        });
    }
};

// --- Global UI Bindings ---
function clearJsonData() { document.getElementById('json_data').value = ''; }
function clearOutputField() { document.getElementById('output').value = ''; }
window.closeWpMenu = () => { document.getElementById('wpContext').style.display = 'none'; document.getElementById('rotationHandle').style.display = 'none'; };

document.addEventListener('DOMContentLoaded', () => {
    RouteProcessor.updateRouteList();
    
    document.getElementById('processBtn').onclick = RouteProcessor.process;
    document.getElementById('exportZipBtn').onclick = RouteProcessor.exportAllRoutesAsZip;
    document.getElementById('clearCacheBtn').onclick = () => {
        if(confirm('Delete all saved routes?')) {
            localStorage.removeItem('routes');
            RouteProcessor.updateRouteList();
        }
    };
    
    document.getElementById('copyOutputBtn').onclick = () => {
        const out = document.getElementById('output');
        out.select();
        document.execCommand('copy');
        // Simple visual feedback
        const originalText = document.getElementById('copyOutputBtn').textContent;
        document.getElementById('copyOutputBtn').textContent = "Copied!";
        setTimeout(() => document.getElementById('copyOutputBtn').textContent = originalText, 1000);
    };

});
