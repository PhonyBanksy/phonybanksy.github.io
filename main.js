/**
 * main.js
 * Entry point — wires up all modules after DOM is ready.
 * Load order: math-utils → route-processor → map-visualizer → inspector → main → main-overrides
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Authentication UI so the login button and Firebase listeners work
  if (window.AuthUI) {
    window.AuthUI.init();
  }

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

  window.addEventListener('load', async () => {
    // Priority 1: community page handoff
    const pendingJson = localStorage.getItem('mt_transfer_json');

    if (pendingJson) {
      const textArea = document.getElementById('json_data');
      if (textArea) {
        textArea.value = pendingJson;
        localStorage.removeItem('mt_transfer_json');
        document.getElementById('processBtn')?.click();
        console.log("Successfully auto-loaded route from community!");
      }
    } else {
      const firstVisit = !localStorage.getItem('mt_visited');
      const lastRoute  = localStorage.getItem('mt_last_route');

      if (firstVisit) {
        // First time ever — show the kitty welcome route
        localStorage.setItem('mt_visited', '1');
        try {
          const resp = await fetch('cat.json');
          if (resp.ok) {
            const catData = await resp.json();
            const catStr  = JSON.stringify(catData, null, 2);
            document.getElementById('json_data').value = catStr;
            document.getElementById('output').value    = catStr;
            if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
            const hint = document.querySelector('.map-hint');
            if (hint) {
              hint.textContent = '🐱 Welcome! Load your own route JSON to get started';
              hint.classList.add('welcome');
              setTimeout(() => {
                hint.textContent = 'Scroll to Zoom · Drag to Pan · Click Waypoint to Select';
                hint.classList.remove('welcome');
              }, 4000);
            }
          }
        } catch (e) {
          console.log('cat.json not found, skipping default load');
        }

      } else if (lastRoute) {
        // Returning user — restore their last viewed route
        try {
          const routeData = JSON.parse(lastRoute);
          const str       = JSON.stringify(routeData, null, 2);
          document.getElementById('json_data').value = str;
          document.getElementById('output').value    = str;
          if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
          if (window.reflectRouteCategories) window.reflectRouteCategories(routeData);
        } catch (e) {
          console.log('Could not restore last route');
        }
      }
    }

    // Persist the current output to localStorage whenever it changes
    // so returning users get their last route back
    const outputEl = document.getElementById('output');
    if (outputEl) {
      const saveLastRoute = () => {
        const val = outputEl.value.trim();
        if (val) {
          try { JSON.parse(val); localStorage.setItem('mt_last_route', val); } catch (_) {}
        }
      };
      outputEl.addEventListener('input', saveLastRoute);
      document.getElementById('processBtn')?.addEventListener('click', () => setTimeout(saveLastRoute, 100));
    }
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