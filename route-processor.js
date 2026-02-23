/**
 * route-processor.js
 * Handles batch processing (scale, rotate, reverse) of route waypoints.
 * saveRouteToLocalStorage and updateRouteList are overridden by main-overrides.js.
 */

const RouteProcessor = {

  process() {
    const inputField  = document.getElementById('json_data');
    const outputField = document.getElementById('output');

    const scaleFactor    = parseFloat(document.getElementById('scale_mode')?.value) || 1;
    const reverseChecked = document.getElementById('reverse')?.checked;
    const squareGates        = document.getElementById('boxes')?.checked;

    try {
      const data = JSON.parse(inputField.value);

      if (data && Array.isArray(data.waypoints)) {
        // Guard: if scale is x2 and the input already contains "×2", abort to prevent double-scaling
        if (scaleFactor === 2) {
          const inputName = (data.routeName || '') + ' ' + inputField.value.substring(0, 200);
          const alreadyDoubled = /×2/.test(inputName) ||
            document.getElementById('json_data').value.includes('×2');
          if (alreadyDoubled) {
            outputField.value = 'Aborted: this route appears to already be ×2 scaled. Load the original base route first.';
            return;
          }
        }

        if (reverseChecked) data.waypoints.reverse();

        data.waypoints.forEach(wp => {
          if (!wp.scale3D) wp.scale3D = { x: 1, y: 10, z: 1 };
          wp.scale3D.x = parseFloat(wp.scale3D.x) || 1;   // depth
          wp.scale3D.y = parseFloat(wp.scale3D.y) || 10;  // gate width
          wp.scale3D.z = parseFloat(wp.scale3D.z) || 1;   // height

          wp.scale3D.y = Math.round(wp.scale3D.y * scaleFactor * 100) / 100;
          if (squareGates) wp.scale3D.x = wp.scale3D.y;

          // Preserve existing rotation unchanged
          if (!wp.rotation) wp.rotation = MathUtils.toQuaternion(0);
        });

        outputField.value = JSON.stringify(data, null, 2);

        let suffix = reverseChecked ? '(R) ' : '';
        if (scaleFactor !== 1) suffix += `×${scaleFactor} `;

        this.saveRouteToLocalStorage((data.routeName || 'Unnamed') + ' ' + suffix, data);

        if (window.MapVisualizerInstance) window.MapVisualizerInstance.loadFromOutput();
        this.triggerBlink('processBtn');
      } else {
        outputField.value = 'Error: Input must contain a "waypoints" array.';
      }
    } catch (error) {
      outputField.value = 'JSON Parse Error: ' + error.message;
    }
  },

  triggerBlink(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('blink-active');
      setTimeout(() => btn.classList.remove('blink-active'), 400);
    }
  },

  // Overridden by main-overrides.js
  saveRouteToLocalStorage(routeName, routeData) {
    let routes = JSON.parse(localStorage.getItem('routes')) || [];
    const exists = routes.find(r => r.routeName === routeName);
    if (!exists) {
      routes.push({ routeName, routeData });
      localStorage.setItem('routes', JSON.stringify(routes));
      this.updateRouteList();
    }
  },

  // Overridden by main-overrides.js
  updateRouteList() {},

  exportAllRoutesAsZip() {
    const routes = JSON.parse(localStorage.getItem('routes')) || [];
    if (!routes.length) return alert('Nothing to export.');
    const zip = new JSZip();
    routes.forEach((r, i) => {
      const name = (r.routeName || `route_${i}`).replace(/[^a-z0-9]/gi, '_');
      zip.file(`${name}.json`, JSON.stringify(r.routeData, null, 2));
    });
    zip.generateAsync({ type: 'blob' }).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'motortown_routes.zip';
      a.click();
    });
  }
};

function bindRouteProcessorUI() {
  document.getElementById('processBtn').onclick    = () => RouteProcessor.process();
  document.getElementById('exportZipBtn').onclick  = () => RouteProcessor.exportAllRoutesAsZip();
  document.getElementById('saveCacheBtn').onclick  = () => {
    try {
      const data = JSON.parse(document.getElementById('output').value);
      RouteProcessor.saveRouteToLocalStorage(data.routeName || 'Manual Save', data);
    } catch (_) { alert('No valid output to save.'); }
  };
}
