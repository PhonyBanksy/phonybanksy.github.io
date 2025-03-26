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
                // Reverse if checked
                if (reverseChecked) {
                    data.waypoints.reverse();
                }

                // Apply scaling
                data.waypoints.forEach(waypoint => {
                    if (waypoint.scale3D && typeof waypoint.scale3D.y === 'number') {
                        waypoint.scale3D.y += scaleFactor;
                    }
                });

                // Display the result
                outputField.value = JSON.stringify(data, null, 2);

                // Set suffix
                scaleSuffix = reverseChecked ? `(R) +${scaleFactor}` : `+${scaleFactor}`;
                
                // Save to localStorage
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
        const routes = JSON.parse(localStorage.getItem('routes')) || [];
        routes.push({ routeName, routeData });
        localStorage.setItem('routes', JSON.stringify(routes));
    },

    updateRouteList() {
        const routeListContainer = document.getElementById('routeList');
        const routes = JSON.parse(localStorage.getItem('routes')) || [];
        routeListContainer.innerHTML = '';

        if (routes.length === 0) {
            routeListContainer.innerHTML = '<p>No routes available.</p>';
            return;
        }

        routes.forEach((route, index) => {
            const listItem = document.createElement('li');

            // Delete button
            const deleteButton = document.createElement('span');
            deleteButton.textContent = ' ❌';
            deleteButton.classList.add('delete-btn');
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                RouteProcessor.deleteRoute(index);
            };

            // Append delete button and route name
            listItem.appendChild(deleteButton);
            listItem.appendChild(document.createTextNode(' ' + route.routeName));

            // On click, load the original route and processed data into input and output fields
            listItem.onclick = () => {
    const inputField = document.getElementById('json_data');
    const outputField = document.getElementById('output');
    inputField.value = JSON.stringify(route.routeData, null, 2);
    outputField.value = JSON.stringify(route.routeData, null, 2);

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

    export() {
        const outputField = document.getElementById('output');
        const blob = new Blob([outputField.value], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.json';
        a.click();
        URL.revokeObjectURL(url);
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

        zip.generateAsync({ type: 'blob' })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'routes.zip';
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error generating ZIP:', error);
            });
    },

    clearOutput() {
        document.getElementById('output').value = '';
    }
};

// Route Manager
const RouteManager = {
    clear() {
        if (confirm('Are you sure you want to clear all routes?')) {
            document.getElementById('routeList').innerHTML = '';
            localStorage.removeItem('routes');
        }
    }
};

function clearJsonData() {
    document.getElementById('json_data').value = '';
}
function clearOutputField() {
    document.getElementById('output').value = '';
}
// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    RouteProcessor.updateRouteList();
    document.getElementById('processBtn').onclick = () => RouteProcessor.reverse();
    document.getElementById('copyOutputBtn').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('output').value)
            .then(() => alert('Output copied to clipboard'))
            .catch(() => alert('Failed to copy output'));
    };
    document.getElementById('clearCacheBtn').onclick = () => RouteManager.clear();
    document.getElementById('exportZipBtn').onclick = () => RouteProcessor.exportAllRoutesAsZip();
});
