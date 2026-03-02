/**
 * app.js — RIDE_RIDDLES Application Logic (Bidirectional A* edition)
 * Handles UI interactions and connects to the Bidirectional A* backend.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM refs ─────────────────────────────────────────────────────────────
    const findBtn = document.getElementById('find-path-btn');
    const swapBtn = document.getElementById('swap-btn');
    const srcSel = document.getElementById('source');
    const dstSel = document.getElementById('destination');
    const modeSel = document.getElementById('mode');
    const prefSel = document.getElementById('preference');
    const summaryCard = document.getElementById('summary-card');
    const loadingOv = document.getElementById('loading-overlay');
    const loadingTxt = document.getElementById('loading-text');
    const qualSection = document.getElementById('quality-section');
    const altSection = document.getElementById('alt-section');
    const altList = document.getElementById('alt-list');

    // ── Show summary panel (collapse handled by card-header inline script) ────
    function showSummaryPanel() {
        summaryCard.style.display = 'flex';
    }


    // ── Pre-select different default destinations ────────────────────────────
    dstSel.value = 'Eco Park';

    // ── Swap source / destination ────────────────────────────────────────────
    swapBtn.addEventListener('click', () => {
        const tmp = srcSel.value;
        srcSel.value = dstSel.value;
        dstSel.value = tmp;
    });

    // ── State ────────────────────────────────────────────────────────────────
    let currentRoutes = [];
    let currentMode = 'foot';
    let currentSrc = '';
    let currentDst = '';

    // ── Find Route ────────────────────────────────────────────────────────────
    findBtn.addEventListener('click', runRoute);

    async function runRoute() {
        const source = srcSel.value;
        const destination = dstSel.value;
        const mode = modeSel.value;
        const preference = prefSel.value;

        if (source === destination) {
            alert('Source and destination must be different.');
            return;
        }

        // Loading state
        findBtn.disabled = true;
        loadingTxt.textContent = 'Computing optimal route…';
        loadingOv.style.display = 'flex';
        summaryCard.style.display = 'none';
        qualSection.style.display = 'none';
        altSection.style.display = 'none';
        altList.innerHTML = '';

        if (window.MapRenderer) window.MapRenderer.clearRoutes();
        document.getElementById('pathtype-card').style.display = 'none';

        try {
            const res = await fetch('/api/path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source, destination, mode, preference })
            });
            const data = await res.json();

            if (!data.success) {
                loadingOv.style.display = 'none';
                alert(`\u274c ${data.error || 'No route found.'}`);
                return;
            }

            currentRoutes = [data.main, ...(data.alternatives || [])];
            currentMode = mode;
            currentSrc = source;
            currentDst = destination;

            // Kick off OSRM geometry prefetch in background (no await — UI renders immediately)
            if (window.MapRenderer?.prefetchAllGeometry) {
                window.MapRenderer.prefetchAllGeometry(currentRoutes, mode);
            }

            renderSummary(data.main, 'Main Route');
            renderQuality(data.main.qualityBreakdown);
            renderPathType(data.main.typeBreakdown, data.main.roadSamples, data.main.trafficLevel);
            renderAlternatives(data.alternatives || []);

            if (window.MapRenderer) {
                window.MapRenderer.showRoutes(currentRoutes, 0, mode, source, destination);
            }

        } catch (err) {
            console.error(err);
            alert('\u26a0\ufe0f Server error. Make sure the backend is running.');
        } finally {
            loadingOv.style.display = 'none';
            findBtn.disabled = false;
        }
    }

    // ── Render summary stats ─────────────────────────────────────────────────────
    function renderSummary(route, label) {
        const distM = route.distanceMetres || 0;
        const km = (distM / 1000).toFixed(2);
        const min = route.estTimeMin || '?';
        const statusEl = document.getElementById('summary-status');
        const routeLabel = label || 'Main Route';
        const srcDst = currentSrc && currentDst
            ? `<span style="color:#64748b;font-size:0.88em">${currentSrc} → ${currentDst}</span><br>`
            : '';
        statusEl.innerHTML = `${srcDst}✅ <strong>${routeLabel}</strong> — <strong>${km} km</strong> • ~${min} min`;
        showSummaryPanel();
    }

    // ── Road quality bar ──────────────────────────────────────────────────────
    function renderQuality(qb) {
        if (!qb) return;
        const smooth = qb.smooth || 0;
        const shaded = qb.shaded || 0;
        const rough = qb.problematic || 0;

        document.getElementById('qb-smooth').style.width = `${smooth}%`;
        document.getElementById('qb-shaded').style.width = `${shaded}%`;
        document.getElementById('qb-rough').style.width = `${rough}%`;

        document.getElementById('ql-smooth').textContent = smooth;
        document.getElementById('ql-shaded').textContent = shaded;
        document.getElementById('ql-rough').textContent = rough;

        qualSection.style.display = 'block';
    }

    // ── Alternative route buttons ──────────────────────────────────────────────────
    let altButtons = []; // track for active-state highlight

    function renderAlternatives(alternatives) {
        altButtons = [];
        if (!alternatives.length) return;
        altSection.style.display = 'block';

        altList.appendChild(makeAltBtn('Main Route', '#2563EB', currentRoutes[0], 0));

        const colors = ['#16a34a', '#b91c1c'];
        const labels = ['Alternative 1', 'Alternative 2'];
        alternatives.forEach((alt, idx) => {
            altList.appendChild(makeAltBtn(labels[idx] || `Alt ${idx + 1}`, colors[idx] || '#888', alt, idx + 1));
        });

        setActiveAltBtn(0); // Main Route active by default
    }

    function setActiveAltBtn(activeIdx) {
        altButtons.forEach((btn, i) => {
            const isActive = i === activeIdx;
            btn.style.borderColor = isActive ? 'var(--primary)' : '';
            btn.style.background = isActive ? 'var(--primary-glow)' : '';
        });
    }

    function makeAltBtn(label, color, route, idx) {
        const btn = document.createElement('button');
        btn.className = 'alt-btn';
        altButtons.push(btn);

        const distM = route.distanceMetres || 0;
        const km = (distM / 1000).toFixed(2);
        const min = route.estTimeMin || '?';

        // Diff vs main — only show if meaningfully different
        let diffHtml = '';
        if (idx > 0 && currentRoutes[0]) {
            const mainDist = currentRoutes[0].distanceMetres || 0;
            const mainMin = currentRoutes[0].estTimeMin || 0;
            const dMetres = distM - mainDist;
            const dMin = (route.estTimeMin || 0) - mainMin;
            const parts = [];
            if (Math.abs(dMin) >= 1) {
                const s = dMin > 0 ? `+${dMin}` : `${dMin}`;
                parts.push(`<span class="alt-btn-diff" style="color:${dMin > 0 ? '#dc2626' : '#16a34a'}">${s} min</span>`);
            }
            if (Math.abs(dMetres) >= 50) {
                const dKm = (dMetres / 1000).toFixed(1);
                parts.push(`<span class="alt-btn-diff" style="color:${dMetres > 0 ? '#dc2626' : '#16a34a'}">${dMetres > 0 ? '+' : ''}${dKm} km</span>`);
            }
            diffHtml = parts.length ? ' ' + parts.join(' ') : '';
        }

        btn.innerHTML = `
            <span style="width:14px;height:14px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block;"></span>
            <span class="alt-btn-text">
                <span class="alt-btn-label">${label}</span>
                <span class="alt-btn-meta">${km} km &bull; ~${min} min${diffHtml}</span>
            </span>
        `;

        btn.onclick = () => {
            setActiveAltBtn(idx);
            if (window.MapRenderer) {
                window.MapRenderer.showRoutes(currentRoutes, idx, currentMode, currentSrc, currentDst);
            }
            renderSummary(route, label);
            renderQuality(route.qualityBreakdown);
            renderPathType(route.typeBreakdown, route.roadSamples, route.trafficLevel);
        };
        return btn;
    }


    // ── PATH TYPE card ───────────────────────────────────────────────────────
    const pathtypeCard = document.getElementById('pathtype-card');
    const pathtypeRows = document.getElementById('pathtype-rows');
    const trafficBadge = document.getElementById('traffic-badge');

    /** Position pathtype-card snugly below the search-card */
    function positionPathtypeCard() {
        const searchCard = document.getElementById('search-card');
        const rect = searchCard.getBoundingClientRect();
        // top of search card relative to .map-stage
        const mapStage = document.querySelector('.map-stage');
        const stageRect = mapStage.getBoundingClientRect();
        const topOffset = rect.bottom - stageRect.top + 10; // 10px gap
        pathtypeCard.style.top = topOffset + 'px';
    }

    /**
     * Traffic model (per user spec):
     *  - 4-lane:       always 25% crowded
     *  - 2-lane/oneway: 50% crowded 09:00–21:00, otherwise 10%
     *  - narrow alley:  always 0% crowded
     * h = current local hour (0-23)
     */
    function computeTraffic(tb, h) {
        // tb = { '6-lane': pct, '4-lane': pct, '2-lane': pct, 'one way': pct, 'narrow alley': pct }
        const isPeak = h >= 9 && h < 21;
        const isMorn = h >= 9 && h < 12;
        const isEve = h >= 16 && h < 18;

        const lane6pct = tb['6-lane'] || 0;
        const lane4pct = tb['4-lane'] || 0;
        const lane2pct = (tb['2-lane'] || 0) + (tb['one way'] || 0);
        const narrowpct = tb['narrow alley'] || 0;

        // 6-lane: always 30% (fast highway baseline)
        // 4-lane: always 25%
        // 2-lane/oneway: 50% in peak, 10% off-peak
        // narrow: never crowded
        const lane6factor = 30;
        const lane4factor = 25;
        const lane2factor = isPeak ? 50 : 10;
        const narrowfactor = 0;

        const weighted =
            (lane6pct / 100) * lane6factor +
            (lane4pct / 100) * lane4factor +
            (lane2pct / 100) * lane2factor +
            (narrowpct / 100) * narrowfactor;

        // Normalise to 0-100
        const score = Math.min(100, weighted);

        if (score < 10) return { label: 'FREE', cls: 'traf-free' };
        if (score < 25) return { label: 'LOW', cls: 'traf-low' };
        if (score < 45) return { label: 'MEDIUM', cls: 'traf-medium' };
        return { label: 'HIGH', cls: 'traf-high' };
    }

    const TYPE_META = {
        '6-lane': { label: '6-Lane Road', cls: 'lane6' },
        '4-lane': { label: '4-Lane Road', cls: 'lane4' },
        '2-lane': { label: '2-Lane Road', cls: 'lane2' },
        'one way': { label: 'One-Way Road', cls: 'oneway' },
        'narrow alley': { label: 'Narrow Alley', cls: 'narrow' },
    };

    function renderPathType(tb, samples, serverTrafficLevel) {
        if (!tb) return;

        pathtypeRows.innerHTML = '';

        const order = ['6-lane', '4-lane', '2-lane', 'one way', 'narrow alley'];
        for (const key of order) {
            const pct = tb[key] || 0;
            const meta = TYPE_META[key];
            const roadName = (samples && samples[key]) ? samples[key] : null;

            const row = document.createElement('div');
            row.className = 'pt-row';
            row.innerHTML = `
                <div class="pt-row-top">
                    <span class="pt-dot ${meta.cls}"></span>
                    <span class="pt-name">${meta.label}</span>
                    <span class="pt-pct">${pct}%</span>
                </div>
                ${roadName ? `<div class="pt-road-name">${roadName}</div>` : ''}
                <div class="pt-bar-track">
                    <div class="pt-bar-fill ${meta.cls}" style="width:${pct}%"></div>
                </div>
            `;
            pathtypeRows.appendChild(row);
        }

        // Traffic — prefer server dataset value, fall back to time-based model
        let traffic;
        if (serverTrafficLevel) {
            const MAP = {
                'Low': { label: 'LOW', cls: 'traf-low' },
                'Medium': { label: 'MEDIUM', cls: 'traf-medium' },
                'High': { label: 'HIGH', cls: 'traf-high' }
            };
            traffic = MAP[serverTrafficLevel] || computeTraffic(tb, new Date().getHours());
        } else {
            const nowHour = new Date().getHours();
            traffic = computeTraffic(tb, nowHour);
        }
        trafficBadge.textContent = traffic.label;
        trafficBadge.className = 'traffic-badge ' + traffic.cls;

        // Position & show
        positionPathtypeCard();
        pathtypeCard.style.display = 'flex';
    }

    function hidePathType() {
        pathtypeCard.style.display = 'none';
    }
});

