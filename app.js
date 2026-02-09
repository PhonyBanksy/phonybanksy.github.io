const RouteProcessor = {
    reverse() {
        const inputField = document.getElementById('json_data');
        const outputField = document.getElementById('output');
        const scaleFactor = parseInt(document.getElementById('scale_mode').value);
        const reverseChecked = document.getElementById('reverse').checked;
        let scaleSuffix = '';

        try {
            const data = JSON.parse(inputField.value);

            if (data && Array.isArray(data.waypoints)) {
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                data.waypoints.forEach(waypoint => {
                    if (waypoint.scale3D && typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }
                });

                outputField.value = JSON.stringify(data, null, 2);
                scaleSuffix = reverseChecked ? `(R) +${scaleFactor}` : `+${scaleFactor}`;
                
                // Save with overwrite check
                RouteProcessor.saveRouteToLocalStorage(data.routeName + ' ' + scaleSuffix, data);
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

            if (!Array.isArray(routes)) {
                routes = [];
            }

            const normalizedRouteName = routeName.trim().toLowerCase();
            const existingIndex = routes.findIndex(route => route.routeName.trim().toLowerCase() === normalizedRouteName);

            // Overwrite Logic
            if (existingIndex !== -1) {
                const confirmOverwrite = confirm(`Route "${routeName}" already exists. Would you like to overwrite it?`);
                if (confirmOverwrite) {
                    routes[existingIndex] = { routeName, routeData };
                } else {
                    return; // Exit without saving
                }
            } else {
                routes.push({ routeName, routeData });
            }

            localStorage.setItem('routes', JSON.stringify(routes));
            RouteProcessor.updateRouteList();
        } catch (error) {
            console.error("Error saving route:", error);
        }
    },

    updateRouteList() {
        const routeListContainer = document.getElementById('routeList');
        let routes = JSON.parse(localStorage.getItem('routes')) || [];

        if (!Array.isArray(routes)) {
            routes = [];
            localStorage.setItem('routes', JSON.stringify(routes));
        }

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
                const inputField = document.getElementById('json_data');
                inputField.value = JSON.stringify(route.routeData, null, 2);
                // Trigger visual update
                document.getElementById('visualizeBtn').click();
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

// Function to handle individual waypoint editing from the popup
function saveWaypointEdit() {
    const inputField = document.getElementById('json_data');
    const index = window.getSelectedWaypointIndex();
    const newScaleY = parseFloat(document.getElementById('editScaleY').value);

    try {
        const data = JSON.parse(inputField.value);
        if (index !== null && data.waypoints[index]) {
            // Update the data
            data.waypoints[index].scale3D.y = newScaleY;
            
            // Put updated JSON back into input field
            inputField.value = JSON.stringify(data, null, 2);
            
            // Process automatically (updates output and visualizer)
            RouteProcessor.reverse();
            
            // Close editor
            window.closeEditor();
        }
    } catch (e) {
        alert("Error updating waypoint: " + e.message);
    }
}

const RouteManager = {
    clear() {
        if (confirm('Are you sure you want to clear all routes?')) {
            localStorage.removeItem('routes');
            RouteProcessor.updateRouteList();
        }
    }
};

function clearJsonData() { document.getElementById('json_data').value = ''; }
function clearOutputField() { document.getElementById('output').value = ''; }

document.addEventListener('DOMContentLoaded', () => {
    RouteProcessor.updateRouteList();
    document.getElementById('processBtn').onclick = () => RouteProcessor.reverse();
    document.getElementById('copyOutputBtn').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('output').value)
            .then(() => alert('Output copied to clipboard'));
    };
    document.getElementById('clearCacheBtn').onclick = () => RouteManager.clear();
    document.getElementById('exportZipBtn').onclick = () => RouteProcessor.exportAllRoutesAsZip();
});