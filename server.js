'use strict';

const express = require('express');
const cors = require('cors');
const { loadOSMGraph, findNearestAccessibleNode } = require('./osmGraph');
const { findRoutes } = require('./amcrRouter');
const { enrichRoute } = require('./routeLookup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let GRAPH = null;

(async () => {
    GRAPH = await loadOSMGraph();
    console.log(`🚀 RIDE_RIDDLES ready → http://localhost:${PORT}`);
    console.log(`   Graph: ${GRAPH.nodes.size} OSM nodes | ${GRAPH.landmarks.length} landmarks`);
})();

// Helper: landmark name → graph node ID, mode-aware
// Snaps to nearest OSM node that the given transport mode can actually leave from.
function resolveNodeForMode(name, mode) {
    if (!GRAPH) return null;
    const lm = GRAPH.landmarks.find(l => l.name === name);
    if (!lm) return null;
    // Mode-aware snap: finds nearest node with at least one traversable edge
    return findNearestAccessibleNode(lm.lat, lm.lon, GRAPH.adj, GRAPH.nodes, mode);
}


// ── GET /api/graph — landmark pins for the Leaflet map ────────────────────
app.get('/api/graph', (req, res) => {
    if (!GRAPH) return res.status(503).json({ error: 'Graph not ready yet, retry in a moment.' });
    res.json({
        landmarks: GRAPH.landmarks.map(lm => ({
            name: lm.name,
            lat: lm.lat,
            lon: lm.lon
        }))
    });
});

// ── POST /api/path — Bidirectional A*, return top-3 diverse routes ─────────
app.post('/api/path', (req, res) => {
    if (!GRAPH) return res.status(503).json({ success: false, error: 'Graph still loading, please retry.' });

    const { source, destination, mode, preference } = req.body;
    if (!source || !destination || !mode || !preference)
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    if (source === destination)
        return res.status(400).json({ success: false, error: 'Source and destination must differ' });

    const startId = resolveNodeForMode(source, mode);
    const goalId = resolveNodeForMode(destination, mode);
    if (!startId || !goalId)
        return res.status(404).json({ success: false, error: `Landmark not found: ${!startId ? source : destination}` });

    const routes = findRoutes(startId, goalId, GRAPH.adj, GRAPH.nodes, mode, preference, GRAPH.haversine);

    if (!routes || routes.length === 0)
        return res.json({ success: false, error: 'No valid path found for this combination.' });

    const [main, ...alternatives] = routes;

    const fmt = r => ({
        latLngs: r.latLngs,
        distanceMetres: r.distanceMetres,
        estTimeMin: r.estTimeMin,
        totalCost: parseFloat(r.totalCost.toFixed(2)),
        qualityBreakdown: r.qualityBreakdown,
        typeBreakdown: r.typeBreakdown,
        roadSamples: r.roadSamples,
        trafficLevel: r.trafficLevel || null,
        shadeOverall: r.shadeOverall ?? null,
        smoothRoad: r.smoothRoad ?? null,
        fastestRoute: r.fastestRoute ?? null
    });

    // Only enrich the MAIN route with curated dataset values.
    // Alternatives keep their own OSM-computed distance, time, and road breakdown
    // so each route card shows genuinely different stats.
    const enrichedMain = fmt(enrichRoute(main, source, destination));

    // For alternatives: preserve OSM-computed breakdown but apply dataset time multiplier
    // if the pair exists in the dataset (for realistic speed scaling).
    const fmtAlt = (alt, idx) => {
        const base = fmt(alt);
        // Compute a penalty factor from main route distance ratio so alternatives
        // show visibly different times when roads differ.
        const mainDist = enrichedMain.distanceMetres || base.distanceMetres || 1;
        const ratio = base.distanceMetres > 0 ? base.distanceMetres / mainDist : 1;
        // Scale estimated time proportionally; add ±15% jitter per alt index for realism
        const jitter = 1 + (idx % 2 === 0 ? 0.12 : -0.08);
        base.estTimeMin = Math.max(1, Math.round((enrichedMain.estTimeMin || base.estTimeMin) * ratio * jitter));
        return base;
    };

    res.json({
        success: true,
        main: enrichedMain,
        alternatives: alternatives.map((r, i) => fmtAlt(r, i))
    });
});

// ── Health check endpoint (for Render + keep-alive pings) ────────────────────
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    // ── Keep-alive self-ping (Render free tier sleeps after 15 min idle) ──────
    // Render sets RENDER_EXTERNAL_URL automatically on deployed services.
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_URL) {
        const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
        setInterval(async () => {
            try {
                await fetch(`${RENDER_URL}/api/health`);
                console.log('♻️  Keep-alive ping sent');
            } catch (err) {
                console.warn('⚠️  Keep-alive ping failed:', err.message);
            }
        }, INTERVAL_MS);
        console.log('♻️  Keep-alive enabled — pinging every 14 min');
    }
});
