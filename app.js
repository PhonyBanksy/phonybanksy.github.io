const RouteProcessor = {
    reverse() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        const scaleFactor = parseInt(document.getElementById('scale_mode').value);
        const reverseChecked = document.getElementById('reverse').checked;
        const boxesChecked = document.getElementById('boxes').checked; // Check for "Boxes?"
        let scaleSuffix = '';

        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                data.waypoints.forEach(waypoint => {
                    if (waypoint.scale3D) {
                        // Apply standard width scaling
                        if (typeof waypoint.scale3D.y === 'number') {
                            waypoint.scale3D.y += scaleFactor;
                        }
                        // Boxes logic: Set depth (x) equal to width (y)
                        if (boxesChecked) {
                            waypoint.scale3D.x = waypoint.scale3D.y;
                        }
                    }
                });

                outputField.value = JSON.stringify(data, null, 2);
                scaleSuffix = reverseChecked ? `(R) +${scaleFactor}` : `+${scaleFactor}`;
                if (boxesChecked) scaleSuffix += ' [Box]';
                
                RouteProcessor.saveRouteToLocalStorage(data.routeName + ' ' + scaleSuffix, data);
                RouteProcessor.updateRouteList();
                
                // Trigger a re-draw on the canvas after processing
                if (window.refreshCanvas) window.refreshCanvas();
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
            const normalizedRouteName = routeName.trim().toLowerCase();
            if (routes.some(route => route.routeName.trim().toLowerCase() === normalizedRouteName)) return;
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
        routeListContainer.innerHTML = '';
        if (routes.length === 0) {
            routeListContainer.innerHTML = '<p>No routes available.</p>';
            return;
        }
        routes.forEach((route) => {
            const listItem = document.createElement('li');
            listItem.textContent = route.routeName;
            listItem.onclick = () => {
                document.getElementById('json_data').value = JSON.stringify(route.routeData, null, 2);
                document.getElementById('output').value = JSON.stringify(route.routeData, null, 2);
                if (window.refreshCanvas) window.refreshCanvas();
            };
            routeListContainer.appendChild(listItem);
        });
    }
};

// Functions to handle the new individual waypoint menu
window.toggleWpSubMenu = (mode) => {
    document.getElementById('wpAdjustMenu').style.display = mode === 'adjust' ? 'flex' : 'none';
    document.getElementById('wpRotateMenu').style.display = mode === 'rotate' ? 'block' : 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    RouteProcessor.updateRouteList();
    document.getElementById('processBtn').onclick = () => RouteProcessor.reverse();
    document.getElementById('copyOutputBtn').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('output').value)
            .then(() => alert('Copied!'))
            .catch(() => alert('Failed to copy'));
    };
});