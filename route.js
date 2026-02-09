document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('routeCanvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const imageConfig = {
        naturalWidth: 4000,
        naturalHeight: 4000,
        imageOffsetX: 2381,
        imageOffsetY: 574,
        gameToImageScale: 0.002,
        flipY: false,
        offsetX: 0,
        offsetY: 0,
        scaleFactor: 0.93
    };

    const mapImage = new Image();
    mapImage.src = 'map.jpg';

    const updateCanvasSize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    updateCanvasSize();
    container.appendChild(canvas);

    let viewState = {
        panX: canvas.width / 2,
        panY: canvas.height / 2,
        scale: 1,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        hasFitView: false
    };

    let selectedWaypointIndex = null;

    const gameToImageX = (gameX) => 
        (gameX * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetX + 
        imageConfig.offsetX -
        imageConfig.naturalWidth / 2;

    const gameToImageY = (gameY) => 
        (imageConfig.flipY ? -1 : 1) * (gameY * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetY + 
        imageConfig.offsetY -
        imageConfig.naturalHeight / 2;

    // Helper to get screen coordinates from game coordinates
    const getScreenCoords = (gameX, gameY) => {
        const imgX = gameToImageX(gameX);
        const imgY = gameToImageY(gameY);
        return {
            x: (imgX * viewState.scale) + viewState.panX,
            y: (imgY * viewState.scale) + viewState.panY
        };
    };

    canvas.addEventListener('wheel', (e) => {
        const zoomFactor = 1.1;
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        const direction = e.deltaY < 0 ? 1 : -1;
        const zoom = direction > 0 ? zoomFactor : 1 / zoomFactor;

        const newScale = viewState.scale * zoom;
        if (newScale > 0.1 && newScale < 10) {
            viewState.panX = mouseX - (mouseX - viewState.panX) * zoom;
            viewState.panY = mouseY - (mouseY - viewState.panY) * zoom;
            viewState.scale = newScale;
            drawWaypoints();
            if (selectedWaypointIndex !== null) updateEditorPosition();
        }
        viewState.hasFitView = true;
        e.preventDefault();
    });

    canvas.addEventListener('mousedown', (e) => {
        // Detect click on waypoint
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const waypoints = parseWaypoints();
        let clickedIndex = -1;

        waypoints.forEach((wp, index) => {
            const screen = getScreenCoords(wp.translation.x, wp.translation.y);
            const dist = Math.sqrt((mouseX - screen.x) ** 2 + (mouseY - screen.y) ** 2);
            if (dist < 10) clickedIndex = index;
        });

        if (clickedIndex !== -1) {
            showEditor(clickedIndex, mouseX, mouseY, waypoints[clickedIndex]);
        } else {
            viewState.isDragging = true;
            viewState.dragStartX = e.clientX - viewState.panX;
            viewState.dragStartY = e.clientY - viewState.panY;
            // closeEditor(); // Optional: close editor if clicking empty space
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (viewState.isDragging) {
            viewState.panX = e.clientX - viewState.dragStartX;
            viewState.panY = e.clientY - viewState.dragStartY;
            drawWaypoints();
            if (selectedWaypointIndex !== null) updateEditorPosition();
        }
    });

    ['mouseup', 'mouseleave'].forEach(event => 
        canvas.addEventListener(event, () => {
            viewState.isDragging = false;
        })
    );

	const parseWaypoints = () => {
		try {
			const input = document.getElementById('json_data').value;
			const data = JSON.parse(input);
			return data.waypoints || [];
		} catch (e) {
			return [];
		}
	};

    const showEditor = (index, x, y, wp) => {
        selectedWaypointIndex = index;
        const editor = document.getElementById('waypointEditor');
        if (!editor) return;
        
        editor.style.display = 'block';
        updateEditorPosition();
        document.getElementById('editScaleY').value = wp.scale3D.y;
    };

    const updateEditorPosition = () => {
        const waypoints = parseWaypoints();
        if (selectedWaypointIndex === null || !waypoints[selectedWaypointIndex]) return;
        
        const wp = waypoints[selectedWaypointIndex];
        const screen = getScreenCoords(wp.translation.x, wp.translation.y);
        const editor = document.getElementById('waypointEditor');
        
        editor.style.left = (screen.x + 15) + 'px';
        editor.style.top = (screen.y - 15) + 'px';
    };

    window.closeEditor = () => {
        selectedWaypointIndex = null;
        const editor = document.getElementById('waypointEditor');
        if (editor) editor.style.display = 'none';
    };

    const fitWaypointsInView = (waypoints) => {
        if (waypoints.length === 0 || viewState.hasFitView) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        waypoints.forEach(wp => {
            const x = gameToImageX(wp.translation.x);
            const y = gameToImageY(wp.translation.y);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        const scaleX = canvas.width / width;
        const scaleY = canvas.height / height;
        viewState.scale = Math.min(scaleX, scaleY) * 0.9;
        viewState.panX = canvas.width / 2 - ((minX + maxX) / 2) * viewState.scale;
        viewState.panY = canvas.height / 2 - ((minY + maxY) / 2) * viewState.scale;
    };

    const drawWaypoints = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const waypoints = parseWaypoints();
        if (!mapImage.complete) return;

        fitWaypointsInView(waypoints);

        ctx.save();
        ctx.translate(viewState.panX, viewState.panY);
        ctx.scale(viewState.scale, viewState.scale);

        ctx.drawImage(
            mapImage,
            -imageConfig.naturalWidth / 2,
            -imageConfig.naturalHeight / 2,
            imageConfig.naturalWidth,
            imageConfig.naturalHeight
        );

        waypoints.forEach((wp, index) => {
            const x = gameToImageX(wp.translation.x);
            const y = gameToImageY(wp.translation.y);

            if (index > 0) {
                const prev = waypoints[index - 1];
                ctx.beginPath();
                ctx.moveTo(gameToImageX(prev.translation.x), gameToImageY(prev.translation.y));
                ctx.lineTo(x, y);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2 / viewState.scale;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(x, y, 5 / viewState.scale, 0, Math.PI * 2);
            ctx.fillStyle = (index === selectedWaypointIndex) ? '#ffff00' : '#00f';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / viewState.scale;
            ctx.stroke();

// Draw Numbered Waypoints
			ctx.font = `${24 / viewState.scale}px Arial bold`;
			ctx.strokeStyle = '#000'; // Black outline
			ctx.lineWidth = 3 / viewState.scale; // Width of the outline
			ctx.strokeText(index + 1, x + 8 / viewState.scale, y + 4 / viewState.scale);
			ctx.fillStyle = '#ff0000'; // Red fill
			ctx.fillText(index + 1, x + 8 / viewState.scale, y + 4 / viewState.scale);
            if (index === 0) {
                ctx.fillStyle = '#fff';
                ctx.font = `${14 / viewState.scale}px Arial bold`;
                ctx.fillText('START', x + 10 / viewState.scale, y - 10 / viewState.scale);
            } else if (index === waypoints.length - 1) {
                ctx.fillStyle = '#fff';
                ctx.font = `${14 / viewState.scale}px Arial bold`;
                ctx.fillText('FINISH', x + 10 / viewState.scale, y - 10 / viewState.scale);
            }
        });

        ctx.restore();
    };

    mapImage.addEventListener('load', drawWaypoints);
    window.addEventListener('resize', () => {
        updateCanvasSize();
        drawWaypoints();
    });
    
    document.getElementById('visualizeBtn').addEventListener('click', () => {
        viewState.hasFitView = false;
        drawWaypoints();
    });

    // Handle global function for saving edits from app.js context
    window.getSelectedWaypointIndex = () => selectedWaypointIndex;
});