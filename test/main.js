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

  // 4. Check if we were sent here from the community page with a route to load
  const pending = sessionStorage.getItem('communityRouteLoad');
  if (pending) {
    sessionStorage.removeItem('communityRouteLoad');
    try {
      const routeData = JSON.parse(pending);
      const str = JSON.stringify(routeData, null, 2);
      const inputEl  = document.getElementById('json_data');
      const outputEl = document.getElementById('output');
      if (inputEl)  inputEl.value  = str;
      if (outputEl) outputEl.value = str;
      // Wait a tick for MapVisualizerInstance to be ready
      setTimeout(() => {
        if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
        // Switch to JSON tab so user can see it
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
        const jsonTab = document.querySelector('[data-pane="pane-json"]');
        if (jsonTab) { jsonTab.classList.add('on'); document.getElementById('pane-json').classList.add('on'); }
        // Show toast
        const t = document.getElementById('toast');
        if (t) { t.textContent = 'Community route loaded!'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
      }, 100);
    } catch (e) {
      console.warn('Failed to load community route:', e);
    }
  }
});
