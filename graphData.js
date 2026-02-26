// Graph nodes
const nodes = [
    { id: 'A', x: 0.15, y: 0.2 },
    { id: 'B', x: 0.85, y: 0.15 },
    { id: 'C', x: 0.1, y: 0.8 },
    { id: 'D', x: 0.5, y: 0.5 },
    { id: 'E', x: 0.9, y: 0.7 },
    { id: 'F', x: 0.45, y: 0.9 }
];

// Generate 120 deterministic edges
function generateEdges() {
    const edges = [];
    const types = ['4-lane', '2-lane', 'one way', 'narrow alley'];
    const featuresList = ['none', 'petrol pump', 'EV station'];
    const nodeIds = nodes.map(n => n.id);

    // We create exactly 120 edges (20 per node pair on average, multiple alternative routes)
    let edgeId = 1;
    for (let i = 0; i < nodeIds.length; i++) {
        for (let j = 0; j < nodeIds.length; j++) {
            if (i === j) continue;

            // Generate 4 edges between every pair (6*5 = 30 pairs. 30 * 4 = 120 edges)
            for (let k = 0; k < 4; k++) {
                const type = types[(i + j + k) % types.length];
                const feature = featuresList[(i * j + k) % featuresList.length];

                // Base distance from 10 to 100 cm
                const baseDistance = 10 + ((i * 7 + j * 13 + k * 17) % 91);

                // Add control points for drawing curved lines (bezier offset)
                // -0.3 to 0.3 offset
                const cpOffset = ((k * 31) % 60 - 30) / 100;

                edges.push({
                    id: `e${edgeId++}`,
                    source: nodeIds[i],
                    target: nodeIds[j],
                    distance: baseDistance,
                    type: type,
                    feature: feature,
                    cpOffset: cpOffset // used for rendering curves so lines don't overlap completely
                });
            }
        }
    }
    return edges;
}

const edges = generateEdges();

// Dynamic weighting logic
// User parameters: mode (foot, ev, 4-wheeler, 2-wheeler), preference (smooth, shaded, shortest)
function calculateDynamicWeight(edge, mode, preference) {
    let weight = edge.distance; // base weight is distance

    // Adjust based on node mode
    if (mode === '4-wheeler') {
        if (edge.type === 'narrow alley') weight *= 10; // penalty
        if (edge.type === '4-lane') weight *= 0.8; // bonus
    } else if (mode === 'ev') {
        if (edge.feature === 'EV station') weight *= 0.5; // huge bonus
        if (edge.type === 'narrow alley') weight *= 5;
    } else if (mode === 'foot') {
        if (edge.type === '4-lane') weight *= 3; // dangerous for foot
        if (edge.type === 'narrow alley') weight *= 0.7; // shortcut
    } else if (mode === '2-wheeler') {
        if (edge.type === 'narrow alley') weight *= 0.9;
    }

    // Adjust based on preference
    if (preference === 'smooth') {
        if (edge.type === '4-lane' || edge.type === '2-lane') weight *= 0.8;
        if (edge.type === 'narrow alley') weight *= 2.0;
    } else if (preference === 'shaded') {
        if (edge.type === 'narrow alley') weight *= 0.7; // assuming shaded
        if (edge.type === '4-lane') weight *= 1.5; // exposed
    } else if (preference === 'shortest') {
        // purely relies on distance, minimal modifier
        weight *= 1.0;
    }

    // Safety check for one way
    // For simplicity, generateEdges sets target/source explicitly. 
    // If it's one-way, it's already directional in our datastructure.
    // If mode is foot, they can walk down one-ways against traffic, but vehicles cannot.
    // In our algorithm, edges are directional. We don't add reverse edges automatically.

    return Math.max(0.1, weight); // ensure weight is positive
}

module.exports = {
    nodes,
    edges,
    calculateDynamicWeight
};
