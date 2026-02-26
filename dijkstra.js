const { nodes, edges, calculateDynamicWeight } = require('./graphData');

// Dijkstra algorithm to find the shortest path based on dynamic weights
function findShortestPath(sourceId, targetId, mode, preference) {
    // 1. Calculate weights for all edges based on current combo
    const weightedEdges = edges.map(e => ({
        ...e,
        weight: calculateDynamicWeight(e, mode, preference)
    }));

    // 2. Initialize distances and predecessors
    const distances = {};
    const predecessors = {};
    const unvisited = new Set();
    const edgeToPredecessor = {};

    nodes.forEach(n => {
        distances[n.id] = Infinity;
        predecessors[n.id] = null;
        edgeToPredecessor[n.id] = null;
        unvisited.add(n.id);
    });

    distances[sourceId] = 0;

    // 3. Main loop
    while (unvisited.size > 0) {
        // Find node with minimum distance
        let current = null;
        let minDistance = Infinity;
        for (const nodeId of unvisited) {
            if (distances[nodeId] < minDistance) {
                minDistance = distances[nodeId];
                current = nodeId;
            }
        }

        if (current === null || current === targetId) {
            break; // Target reached or disconnected
        }

        unvisited.delete(current);

        // Relax neighbors
        // We only consider edges where 'source' is the current node
        const neighbors = weightedEdges.filter(e => e.source === current);

        for (const edge of neighbors) {
            const neighborId = edge.target;
            if (!unvisited.has(neighborId)) continue;

            const newDistance = distances[current] + edge.weight;
            if (newDistance < distances[neighborId]) {
                distances[neighborId] = newDistance;
                predecessors[neighborId] = current;
                edgeToPredecessor[neighborId] = edge; // Keep track of which edge we took
            }
        }
    }

    // 4. Backtrack to find path
    const path = [];
    const detailedPath = [];
    let currNode = targetId;

    if (distances[targetId] === Infinity) {
        return null; // No path found
    }

    while (currNode !== null) {
        path.unshift(currNode);
        const edgeTaken = edgeToPredecessor[currNode];
        if (edgeTaken) {
            detailedPath.unshift(edgeTaken);
        }
        currNode = predecessors[currNode];
    }

    return {
        path,
        detailedPath,
        totalCost: distances[targetId]
    };
}

module.exports = {
    findShortestPath
};
