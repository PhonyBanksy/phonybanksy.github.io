document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('routeCanvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Configuration with alignment parameters
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
        dragStartY: 0
    };

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

    const parseWaypoints = () => {
        try {
            const output = document.getElementById('output').value;
            return JSON.parse(output).waypoints || [];
        } catch (e) {
            console.error('Error parsing waypoints:', e);
            return [];
        }
    };

    const fitWaypointsInView = (waypoints) => {
        if (waypoints.length === 0) return;
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
            ctx.fillStyle = '#00f';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / viewState.scale;
            ctx.stroke();

            if (index === 0) {
                ctx.fillStyle = '#fff';
                ctx.font = `${16 / viewState.scale}px Arial bold`;
                ctx.fillText('START', x + 10 / viewState.scale, y - 10 / viewState.scale);
            } else if (index === waypoints.length - 1) {
                ctx.fillStyle = '#fff';
                ctx.font = `${16 / viewState.scale}px Arial bold`;
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
    document.getElementById('visualizeBtn').addEventListener('click', drawWaypoints);
});
