import { bindRouteProcessorUI, RouteProcessor } from './route-processor.js';
import { MapVisualizer } from './map-visualizer.js';
import { setupWaypointUI } from './waypoint-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Route Processor (Load saved routes)
    RouteProcessor.updateRouteList();
    
    // 2. Initialize Map Visualizer
    const visualizer = MapVisualizer();
    
    // 3. Setup Waypoint UI
    setupWaypointUI(visualizer);
    
    // 4. Bind Route Processor Controls
    bindRouteProcessorUI();
    
    // 5. Expose visualizer globally for RouteProcessor to call
    window.MapVisualizer = visualizer;
    
    console.log('✓ App initialized');
});