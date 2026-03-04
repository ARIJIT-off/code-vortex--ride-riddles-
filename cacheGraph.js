/**
 * cacheGraph.js — One-time script to fetch OSM road data from Overpass
 * and save it locally as osm_cache.json so the server doesn't need
 * to hit Overpass on every startup (which fails on cloud IPs like Render).
 *
 * Usage:  node cacheGraph.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BBOX = '22.520,88.320,22.640,88.520';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const ROAD_QUERY = `
[out:json][timeout:120];
(
  way["highway"]["highway"!~"proposed|construction|abandoned|platform|raceway"]
     (${BBOX});
);
out body;
>;
out skel qt;
`;

const CACHE_FILE = path.join(__dirname, 'osm_cache.json');

async function main() {
    console.log('🗺  Fetching OSM road data from Overpass API...');
    console.log('   BBOX:', BBOX);
    console.log('   This may take 30–60 seconds...\n');

    const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ROAD_QUERY),
        signal: AbortSignal.timeout(120000)
    });

    if (!res.ok) {
        throw new Error(`Overpass returned HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    console.log(`✅ Fetched ${json.elements.length} elements from OSM`);

    fs.writeFileSync(CACHE_FILE, JSON.stringify(json), 'utf8');
    const sizeMB = (fs.statSync(CACHE_FILE).size / (1024 * 1024)).toFixed(2);
    console.log(`💾 Saved to ${CACHE_FILE} (${sizeMB} MB)`);
    console.log('\nDone! The server will now use this cached data instead of calling Overpass.');
}

main().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
