document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Route Processor UI
    if (window.RouteProcessor) {
        window.RouteProcessor.updateRouteList();
        window.bindRouteProcessorUI();
    }
    
    // 2. Initialize Map Visualizer (stored globally)
    window.CurrentVisualizer = window.MapVisualizer('routeCanvas', 'output');
    
    // 3. Setup Waypoint UI using the global visualizer
    if (window.setupWaypointUI) {
        window.setupWaypointUI(window.CurrentVisualizer);
    }
    
    console.log('✓ App initialized (Standard Scripts)');
});