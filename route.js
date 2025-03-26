document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('routeCanvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Configuration with alignment parameters
    const imageConfig = {
        // Map image properties
        naturalWidth: 4000,     // New image width
        naturalHeight: 4000,   // New image height
        imageOffsetX: 2350,     // X position of game (0,0) on image
        imageOffsetY: 580,      // Y position of game (0,0) on image
        
        // Coordinate conversion settings
        gameToImageScale: 0.002,  // Scale factor from game units to image
        flipY: false,             // No vertical flip needed
        
        // Waypoint alignment adjustments
        offsetX: 0,             // Reset horizontal offset
        offsetY: 0,             // Reset vertical offset
        scaleFactor: 0.93        // Waypoint scaling factor
    };

    const mapImage = new Image();
    mapImage.src = 'map.jpg';    // Updated image filename

    // Canvas setup
    const updateCanvasSize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    updateCanvasSize();
    container.appendChild(canvas);

    // View state management
    let viewState = {
        panX: canvas.width / 2,
        panY: canvas.height / 2,
        scale: 1,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
    };

    // Coordinate conversions with centering adjustment
    const gameToImageX = (gameX) => 
        (gameX * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetX + 
        imageConfig.offsetX -
        imageConfig.naturalWidth / 2;

    const gameToImageY = (gameY) => 
        (imageConfig.flipY ? -1 : 1) * 
        (gameY * imageConfig.scaleFactor * imageConfig.gameToImageScale) + 
        imageConfig.imageOffsetY + 
        imageConfig.offsetY -
        imageConfig.naturalHeight / 2;

    // Input handling
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
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        viewState.isDragging = true;
        viewState.dragStartX = e.clientX - viewState.panX;
        viewState.dragStartY = e.clientY - viewState.panY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (viewState.isDragging) {
            viewState.panX = e.clientX - viewState.dragStartX;
            viewState.panY = e.clientY - viewState.dragStartY;
            drawWaypoints();
        }
    });

    ['mouseup', 'mouseleave'].forEach(event => 
        canvas.addEventListener(event, () => {
            viewState.isDragging = false;
        })
    );

    // Waypoint processing
    const parseWaypoints = () => {
        try {
            const output = document.getElementById('output').value;
            return JSON.parse(output).waypoints || [];
        } catch (e) {
            console.error('Error parsing waypoints:', e);
            return [];
        }
    };

    // Drawing functions
    const drawWaypoints = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const waypoints = parseWaypoints();
        
        if (!mapImage.complete) return;

        ctx.save();
        ctx.translate(viewState.panX, viewState.panY);
        ctx.scale(viewState.scale, viewState.scale);

        // Draw map background centered
        ctx.drawImage(
            mapImage,
            -imageConfig.naturalWidth / 2,
            -imageConfig.naturalHeight / 2,
            imageConfig.naturalWidth,
            imageConfig.naturalHeight
        );

        // Draw waypoint paths
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

            // Draw waypoint marker
            ctx.beginPath();
            ctx.arc(x, y, 5 / viewState.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#00f';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / viewState.scale;
            ctx.stroke();

            // Draw waypoint label
            ctx.fillStyle = '#fff';
            ctx.font = `${14 / viewState.scale}px Arial`;
            ctx.fillText(`WP${index}`, x + 8 / viewState.scale, y - 8 / viewState.scale);
        });

        ctx.restore();
    };

    // Event listeners
    mapImage.addEventListener('load', drawWaypoints);
    window.addEventListener('resize', () => {
        updateCanvasSize();
        drawWaypoints();
    });
    document.getElementById('visualizeBtn').addEventListener('click', drawWaypoints);
});