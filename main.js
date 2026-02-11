document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Route Processor UI
    // Remove "window." prefix or check binding function directly
    if (typeof RouteProcessor !== 'undefined') {
        RouteProcessor.updateRouteList();
        bindRouteProcessorUI(); // bindRouteProcessorUI is a global function
    }
    
    // 2. Initialize Map Visualizer
    window.MapVisualizerInstance = window.MapVisualizer('routeCanvas', 'output');
    
    // 3. Setup Waypoint UI
    if (typeof setupWaypointUI === 'function') {
        setupWaypointUI(window.MapVisualizerInstance);
    }
});