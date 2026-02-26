const express = require('express');
const cors = require('cors');
const { nodes, edges } = require('./graphData');
const { findShortestPath } = require('./dijkstra');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock Arduino Start API
app.post('/api/start-car', (req, res) => {
    console.log('Arduino Car Start Command Received!');
    res.json({ success: true, message: 'Car started!' });
});

// Provides static graph data (nodes, base edges) to frontend for rendering
app.get('/api/graph', (req, res) => {
    res.json({ nodes, edges });
});

// Computes the shortest path based on inputs
app.post('/api/path', (req, res) => {
    const { source, destination, mode, preference } = req.body;

    if (!source || !destination || !mode || !preference) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const result = findShortestPath(source, destination, mode, preference);

    if (result) {
        res.json({ success: true, ...result });
    } else {
        res.json({ success: false, error: 'No path found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
