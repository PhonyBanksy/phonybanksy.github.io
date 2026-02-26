/**
 * main.js
 * Entry point — wires up all modules after DOM is ready.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Processor setup
  RouteProcessor.updateRouteList();
  bindRouteProcessorUI();

  // 2. Map visualizer setup
  window.MapVisualizerInstance = window.MapVisualizer('routeCanvas', 'output');
  setupWaypointUI(window.MapVisualizerInstance);
  
  // 3. Initialize Auto-Align Tool
  if (window.AutoAlign) {
    window.AutoAlign.init(window.MapVisualizerInstance);
  }

  // 4. Tab switching
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.pane;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
      btn.classList.add('on');
      document.getElementById(target).classList.add('on');
    });
  });

  // 5. Category tag toggles
  document.querySelectorAll('.cat-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('on');
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

  window.reflectRouteCategories = (routeData) => {
    const cats = routeData?._categories || [];
    document.querySelectorAll('.cat-toggle').forEach(btn => {
      btn.classList.toggle('on', cats.includes(btn.dataset.cat));
    });
  };
});

window.addEventListener('load', () => {
  const pendingJson = localStorage.getItem('mt_transfer_json');
  if (pendingJson) {
    const textArea = document.getElementById('json_data');
    if (textArea) {
      textArea.value = pendingJson;
      localStorage.removeItem('mt_transfer_json');
      document.getElementById('processBtn')?.click();
    }
  }
});