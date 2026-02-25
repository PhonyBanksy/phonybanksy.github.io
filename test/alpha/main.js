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
  // Community route handoff from community.html — must run AFTER main-overrides.js
  // so the route tree override of saveRouteToLocalStorage is in place.
  // main-overrides.js is injected on window.load, so we wait for that too.
  const _pendingCommunityRoute = sessionStorage.getItem('communityRouteLoad');
  if (_pendingCommunityRoute) {
    sessionStorage.removeItem('communityRouteLoad');
    window.addEventListener('load', () => {
      // Give main-overrides.js one tick to finish executing after the load event
      setTimeout(() => {
        try {
          const routeData = JSON.parse(_pendingCommunityRoute);
          const str = JSON.stringify(routeData, null, 2);
          const inputEl  = document.getElementById('json_data');
          const outputEl = document.getElementById('output');
          if (inputEl)  inputEl.value  = str;
          if (outputEl) outputEl.value = str;

          // Register in the sidebar tree (uses the overridden saveRouteToLocalStorage)
          const routeName = routeData.routeName || 'Community Route';
          if (typeof RouteProcessor !== 'undefined') {
            RouteProcessor.saveRouteToLocalStorage(routeName, routeData);
          }

          if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
          if (window.reflectRouteCategories) window.reflectRouteCategories(routeData);
          if (RouteProcessor?.updateStateIndicators) RouteProcessor.updateStateIndicators(routeData._routeState || null);

          // Show the map/process tab so user sees it
          document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
          document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
          const processTab = document.querySelector('[data-pane="pane-process"]');
          if (processTab) { processTab.classList.add('on'); document.getElementById('pane-process').classList.add('on'); }

          const t = document.getElementById('toast');
          if (t) { t.textContent = 'Community route loaded!'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
        } catch (e) {
          console.warn('Failed to load community route:', e);
        }
      }, 50);
    });
  }
});
