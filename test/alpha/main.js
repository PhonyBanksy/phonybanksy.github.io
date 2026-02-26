/**
 * main.js
 * Entry point — wires up all modules after DOM is ready.
 * Load order: math-utils → route-processor → map-visualizer → inspector → main → main-overrides
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Wire processor buttons
  RouteProcessor.updateRouteList();
  bindRouteProcessorUI();

  // 2. Map visualizer
  window.MapVisualizerInstance = window.MapVisualizer('routeCanvas', 'output');
  setupWaypointUI(window.MapVisualizerInstance);
  // 3. Tab switching
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.pane;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      btn.classList.add('on');
      document.getElementById(target).classList.add('on');
    });
  });
window.addEventListener('load', () => {
  // Check if a route was sent from the community page
  const pendingJson = localStorage.getItem('mt_transfer_json');
  
  if (pendingJson) {
    const textArea = document.getElementById('json_data');
    if (textArea) {
      // Inject the JSON into the editor's input box
      textArea.value = pendingJson;
      
      // Clear the temporary storage so it doesn't reload every time
      localStorage.removeItem('mt_transfer_json');
      
      // Automatically trigger the 'Process' button to render the map
      document.getElementById('processBtn')?.click();
      console.log("Successfully auto-loaded route from community!");
    }
  }
});
  // 5. Category tag toggles
  document.querySelectorAll('.cat-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      // Store selected categories in current output JSON
      const activeCategories = [...document.querySelectorAll('.cat-toggle.on')].map(b => b.dataset.cat);
      const outputEl = document.getElementById('output');
      if (outputEl && outputEl.value.trim()) {
        try {
          const data = JSON.parse(outputEl.value);
          data._categories = activeCategories;
          const str = JSON.stringify(data, null, 2);
          outputEl.value = str;
          document.getElementById('json_data').value = str;
        } catch (_) {}
      }
    });
  });

  // Helper to reflect categories from loaded route data
  window.reflectRouteCategories = (routeData) => {
    const cats = routeData?._categories || [];
    document.querySelectorAll('.cat-toggle').forEach(btn => {
      btn.classList.toggle('on', cats.includes(btn.dataset.cat));
    });
  };
  // Community route handoff is handled at the bottom of main-overrides.js,
  // after saveRouteToLocalStorage has been overridden and the tree is ready.
});
