const RouteProcessor = {
    process() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        
        const scaleFactor = parseInt(document.getElementById('scale_mode')?.value) || 0;
        // The rotation angle is now ignored for the output generation
        const reverseChecked = document.getElementById('reverse')?.checked || false;

        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                data.waypoints.forEach(waypoint => {
                    // Keep scale processing if intended
                    if (waypoint.scale3D && typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }

                    // REMOVED: waypoint.rotation.y += rotationBatchAngle;
                    // This ensures the output JSON remains unrotated
                });

                outputField.value = JSON.stringify(data, null, 2);
                this.triggerBlink(outputField);
            }
        } catch (e) {
            console.error("Error processing JSON:", e);
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
            li.dataset.index = index;
            li.innerHTML = `<span class="route-name">${route.routeName}</span><span class="delete-route">×</span>`;
            
            li.querySelector('.route-name').onclick = () => {
                this.loadRoute(route, li);
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

    loadRoute(route, element) {
        // 1. Highlight the selected item immediately
        document.querySelectorAll('#routeList li').forEach(el => el.classList.remove('active-route'));
        element.classList.add('active-route');

        // 2. Show loading state in the JSON panel
        const inputContainer = document.querySelector('.json-box');
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.textContent = 'Loading Route...';
        inputContainer.appendChild(loader);

        // 3. Process the data in the next frame to keep UI responsive
        requestAnimationFrame(() => {
            setTimeout(() => {
                const str = JSON.stringify(route.routeData, null, 2);
                document.getElementById('json_data').value = str;
                document.getElementById('output').value = str;
                
                if (window.MapVisualizerInstance) {
                    window.MapVisualizerInstance.loadFromOutput();
                }
                
                // Remove loader
                loader.remove();
            }, 50); 
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