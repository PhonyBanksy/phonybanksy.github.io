document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Route Processor UI
    if (window.RouteProcessor) {
        window.RouteProcessor.updateRouteList();
        window.bindRouteProcessorUI();
    }
    
    // 2. Initialize Map Visualizer (matches naming in route-processor.js)
    window.MapVisualizerInstance = window.MapVisualizer('routeCanvas', 'output');
    
    // 3. Setup Waypoint UI
    if (window.setupWaypointUI) {
        window.setupWaypointUI(window.MapVisualizerInstance);
    }
});

// Helpers for index.html "Clear" buttons
window.clearJsonData = () => { document.getElementById('json_data').value = ''; };
window.clearOutputField = () => { document.getElementById('output').value = ''; };