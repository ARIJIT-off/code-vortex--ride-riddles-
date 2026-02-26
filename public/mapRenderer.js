class MapRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.highlightedEdges = new Set();

        // Handle resizing
        window.addEventListener('resize', this.resize.bind(this));
    }

    async init() {
        await this.fetchGraphData();
        this.resize();
    }

    async fetchGraphData() {
        try {
            const res = await fetch('http://localhost:3000/api/graph');
            const data = await res.json();
            this.nodes = data.nodes;
            this.edges = data.edges;
        } catch (e) {
            console.error('Failed to fetch graph data', e);
        }
    }

    resize() {
        // Match actual display size
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    getEdgeColor(type) {
        switch (type) {
            case '4-lane': return '#ff3366'; // red
            case '2-lane': return '#00e5ff'; // blue
            case 'one way': return '#ff66b2'; // pink
            case 'narrow alley': return '#ff00ff'; // cyber pink
            default: return '#ffffff';
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const w = this.canvas.width;
        const h = this.canvas.height;

        // We draw in two passes: first background edges, then highlighted edges
        // This ensures highlighted edges are always on top

        // 1. Draw Normal Edges
        this.edges.forEach(edge => {
            if (!this.highlightedEdges.has(edge.id)) {
                this.drawEdge(edge, w, h, false);
            }
        });

        // 2. Draw Highlighted Edges
        this.edges.forEach(edge => {
            if (this.highlightedEdges.has(edge.id)) {
                this.drawEdge(edge, w, h, true);
            }
        });

        // 3. Draw Nodes
        this.nodes.forEach(node => {
            const nx = node.x * w;
            const ny = node.y * h;

            // Outer glow
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 18, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.fill();

            // Inner circle
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#00e5ff';
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id, nx, ny - 24);
        });
    }

    drawEdge(edge, w, h, isHighlighted) {
        const sourceNode = this.nodes.find(n => n.id === edge.source);
        const targetNode = this.nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        const sx = sourceNode.x * w;
        const sy = sourceNode.y * h;
        const tx = targetNode.x * w;
        const ty = targetNode.y * h;

        // Calculate control point for quadratic bezier curve
        // This makes the 120 lines not overlap perfectly
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;

        // Perpendicular vector
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const px = -dy / len;
        const py = dx / len;

        // Scale offset by canvas size and edge property
        const maxOffset = Math.min(w, h) * 0.3;
        const cpx = mx + px * maxOffset * edge.cpOffset;
        const cpy = my + py * maxOffset * edge.cpOffset;

        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.quadraticCurveTo(cpx, cpy, tx, ty);

        if (isHighlighted) {
            // "deep bright black" for highlighted (we'll use a very dark but popping color layer)
            this.ctx.lineWidth = 6;
            this.ctx.strokeStyle = '#050505';

            // Add a glow to make "deep bright black" pop against the dark background
            this.ctx.shadowColor = '#ffffff';
            this.ctx.shadowBlur = 15;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // reset

            // Draw an overlay line to give it depth
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.stroke();

        } else {
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = this.getEdgeColor(edge.type);
            // make lines slightly transparent to avoid visual clutter
            this.ctx.globalAlpha = 0.3;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
    }

    highlightPath(detailedPath) {
        this.highlightedEdges.clear();
        if (detailedPath && detailedPath.length > 0) {
            detailedPath.forEach(edge => {
                this.highlightedEdges.add(edge.id);
            });
        }
        this.draw();
    }
}

// Export to window for app.js
window.MapRenderer = new MapRenderer('map-canvas');
