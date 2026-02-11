const RouteProcessor = {
    /**
     * Main processing function that handles Reversing, Scaling, and Rotating waypoints.
     */
    process() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        
        // Get values from the UI controls
        const scaleFactor = parseInt(document.getElementById('scale_mode').value) || 0;
        const rotationAngle = parseFloat(document.getElementById('rotation_angle')?.value) || 0;
        const reverseChecked = document.getElementById('reverse').checked;
        
        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                // 1. Reverse the route if the checkbox is checked
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                // 2. Process each waypoint for Scale and Rotation
                data.waypoints.forEach(waypoint => {
                    // Apply Scaling to Gate Width (y-axis in MotorTown)
                    if (waypoint.scale3D && typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }

                    // Apply Rotation (Yaw/Z-axis adjustment)
                    if (waypoint.rotation && typeof waypoint.rotation.z === 'number') {
                        waypoint.rotation.z += rotationAngle;
                    }
                });

                // 3. Display the result in the output field
                outputField.value = JSON.stringify(data, null, 2);

                // Create a label for the saved route
                let suffix = reverseChecked ? `(R) ` : '';
                suffix += `W+${scaleFactor} Rot:${rotationAngle}°`;
                
                // 4. Save to localStorage and refresh UI list
                const name = (data.routeName || "Unnamed Route") + ' ' + suffix;
                RouteProcessor.saveRouteToLocalStorage(name, data);
                RouteProcessor.updateRouteList();
            } else {
                outputField.value = 'Invalid input. Expected a JSON text with a "waypoints" array.';
            }
        } catch (error) {
            outputField.value = 'Error parsing JSON: ' + error.message;
        }
    },

    saveRouteToLocalStorage(routeName, routeData) {
        try {
            let routes = JSON.parse(localStorage.getItem('routes')) || [];
            if (!Array.isArray(routes)) routes = [];

            const normalizedName = routeName.trim().toLowerCase();
            if (routes.some(r => r.routeName.trim().toLowerCase() === normalizedName)) {
                alert('Route already exists in your list');
                return;
            }

            routes.push({ routeName, routeData });
            localStorage.setItem('routes', JSON.stringify(routes));
            RouteProcessor.updateRouteList();
        } catch (error) {
            console.error("Error saving route:", error);
        }
    },

    updateRouteList() {
        const routeListContainer = document.getElementById('routeList');
        let routes = JSON.parse(localStorage.getItem('routes')) || [];
        if (!Array.isArray(routes)) routes = [];

        routeListContainer.innerHTML = '';
        if (routes.length === 0) {
            routeListContainer.innerHTML = '<p>No routes available.</p>';
            return;
        }

        routes.forEach((route, index) => {
            const listItem = document.createElement('li');
            
            const deleteButton = document.createElement('span');
            deleteButton.textContent = ' ❌';
            deleteButton.classList.add('delete-btn');
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                RouteProcessor.deleteRoute(index);
            };

            listItem.appendChild(deleteButton);
            listItem.appendChild(document.createTextNode(' ' + route.routeName));
            listItem.onclick = () => {
                document.getElementById('json_data').value = JSON.stringify(route.routeData, null, 2);
                document.getElementById('output').value = JSON.stringify(route.routeData, null, 2);
            };

            routeListContainer.appendChild(listItem);
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
        if (routes.length === 0) {
            alert('No routes available to export.');
            return;
        }

        const zip = new JSZip();
        routes.forEach((route, index) => {
            const fileName = `${route.routeName || 'Route_' + (index + 1)}.json`;
            zip.file(fileName, JSON.stringify(route.routeData, null, 2));
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'routes.zip';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
};

// Global helpers for UI buttons
function clearJsonData() { document.getElementById('json_data').value = ''; }
function clearOutputField() { document.getElementById('output').value = ''; }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    RouteProcessor.updateRouteList();
    
    // Wire up buttons
    document.getElementById('processBtn').onclick = () => RouteProcessor.process();
    document.getElementById('exportZipBtn').onclick = () => RouteProcessor.exportAllRoutesAsZip();
    
    document.getElementById('copyOutputBtn').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('output').value)
            .then(() => alert('Output copied to clipboard'))
            .catch(() => alert('Failed to copy'));
    };
    
    document.getElementById('clearCacheBtn').onclick = () => {
        if (confirm('Clear all saved routes?')) {
            localStorage.removeItem('routes');
            RouteProcessor.updateRouteList();
        }
    };
});