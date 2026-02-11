const RouteProcessor = {
    process() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        
        const scaleFactor = parseInt(document.getElementById('scale_mode')?.value) || 0;
        const rotationBatchAngle = parseFloat(document.getElementById('rotation_angle')?.value) || 0;
        const reverseChecked = document.getElementById('reverse')?.checked;
        const squareGates = document.getElementById('boxes')?.checked;
        
        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                data.waypoints.forEach(waypoint => {
                    if (!waypoint.scale3D) waypoint.scale3D = { x: 1, y: 10, z: 1 };

                    if (typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }

                    if (squareGates) {
                        waypoint.scale3D.x = waypoint.scale3D.y;
                    }

                    let currentAngle = 0;
                    if (waypoint.rotation) {
                        currentAngle = MathUtils.toAngle(waypoint.rotation);
                    }
                    
                    // Added +90 for MotorTown alignment
                    const newAngle = currentAngle + rotationBatchAngle + 90;
                    waypoint.rotation = MathUtils.toQuaternion(newAngle);
                });

                const resultJson = JSON.stringify(data, null, 2);
                outputField.value = resultJson;

                let suffix = reverseChecked ? `(R) ` : '';
                if (scaleFactor > 0) suffix += `W+${scaleFactor} `;
                if (rotationBatchAngle !== 0) suffix += `Rot:${rotationBatchAngle}°`;
                
                const name = (data.routeName || "Unnamed") + ' ' + suffix;
                this.saveRouteToLocalStorage(name, data);
                
                if (window.MapVisualizerInstance) {
                    window.MapVisualizerInstance.loadFromOutput();
                }

                this.triggerBlink('processBtn');
            } else {
                outputField.value = 'Error: Input must contain a "waypoints" array.';
            }
        } catch (error) {
            outputField.value = 'JSON Parse Error: ' + error.message;
        }
    },

    triggerBlink(btnId) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.add('blink-active');
            setTimeout(() => btn.classList.remove('blink-active'), 400);
        }
    },

    saveRouteToLocalStorage(routeName, routeData) {
        let routes = JSON.parse(localStorage.getItem('routes')) || [];
        const exists = routes.find(r => r.routeName === routeName);
        if (!exists) {
            routes.push({ routeName, routeData });
            localStorage.setItem('routes', JSON.stringify(routes));
            this.updateRouteList();
        }
        this.triggerBlink('saveCacheBtn');
    },

    updateRouteList() {
        const list = document.getElementById('routeList');
        let routes = JSON.parse(localStorage.getItem('routes')) || [];
        list.innerHTML = routes.length ? '' : '<li>No saved routes</li>';
        routes.forEach((route, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="route-name">${route.routeName}</span><span class="delete-route">×</span>`;
            li.querySelector('.route-name').onclick = () => {
                const str = JSON.stringify(route.routeData, null, 2);
                document.getElementById('json_data').value = str;
                document.getElementById('output').value = str;
                if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
            };
            li.querySelector('.delete-route').onclick = (e) => {
                e.stopPropagation();
                routes.splice(index, 1);
                localStorage.setItem('routes', JSON.stringify(routes));
                this.updateRouteList();
            };
            list.appendChild(li);
        });
    },

    exportAllRoutesAsZip() {
        const routes = JSON.parse(localStorage.getItem('routes')) || [];
        if (!routes.length) return alert('Nothing to export.');
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

function bindRouteProcessorUI() {
    document.getElementById('processBtn').onclick = () => RouteProcessor.process();
    document.getElementById('exportZipBtn').onclick = () => RouteProcessor.exportAllRoutesAsZip();
    document.getElementById('saveCacheBtn').onclick = () => {
        try {
            const data = JSON.parse(document.getElementById('output').value);
            RouteProcessor.saveRouteToLocalStorage(data.routeName || "Manual Save", data);
        } catch(e) { alert("No valid output to save."); }
    };
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
        RouteProcessor.triggerBlink('copyOutputBtn');
    };
}