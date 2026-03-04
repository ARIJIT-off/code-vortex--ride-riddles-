/**
 * app.js — RIDE_RIDDLES Application Logic
 * Handles UI interactions and connects to the backend.
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
    const advSection = document.getElementById('advanced-section');
    const pathtypeRows = document.getElementById('pathtype-rows');
    const trafficBadge = document.getElementById('traffic-badge');
    const trafficBanner = document.getElementById('traffic-banner');

    // ── Show summary panel ────────────────────────────────────────────────────
    function showSummaryPanel() {
        summaryCard.style.display = 'flex';
        // If hidden via sidebar toggle, un-hide
        summaryCard.classList.remove('sidebar-hidden');
        var toggleBtn = document.getElementById('toggle-summary');
        if (toggleBtn) toggleBtn.textContent = '▶';
    }

    // ── Pre-select different default destinations ────────────────────────────
    dstSel.value = 'Eco Park';

    // ── Swap source / destination ────────────────────────────────────────────
    swapBtn.addEventListener('click', () => {
        const tmp = srcSel.value;
        srcSel.value = dstSel.value;
        dstSel.value = tmp;
        // Sync to mobile selects
        const mSrc = document.getElementById('m-source');
        const mDst = document.getElementById('m-destination');
        if (mSrc) mSrc.value = srcSel.value;
        if (mDst) mDst.value = dstSel.value;
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
        advSection.style.display = 'none';

        if (window.MapRenderer) window.MapRenderer.clearRoutes();

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

    // ── Render summary stats ─────────────────────────────────────────────────
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

    // ── Alternative route buttons ──────────────────────────────────────────────
    let altButtons = [];

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

        setActiveAltBtn(0);
    }

    function setActiveAltBtn(activeIdx) {
        altButtons.forEach((btn, i) => {
            const isActive = i === activeIdx;
            btn.classList.toggle('alt-btn--active', isActive);
        });
    }

    function makeAltBtn(label, color, route, idx) {
        const btn = document.createElement('button');
        btn.className = 'alt-btn';
        altButtons.push(btn);

        const distM = route.distanceMetres || 0;
        const km = (distM / 1000).toFixed(2);
        const min = route.estTimeMin || '?';

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
            <span class="alt-btn-dot" style="background:${color}"></span>
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


    // ── Traffic model ─────────────────────────────────────────────────────────
    function computeTraffic(tb, h) {
        const isPeak = h >= 9 && h < 21;
        const lane6pct = tb['6-lane'] || 0;
        const lane4pct = tb['4-lane'] || 0;
        const lane2pct = (tb['2-lane'] || 0) + (tb['one way'] || 0);
        const narrowpct = tb['narrow alley'] || 0;

        const weighted =
            (lane6pct / 100) * 30 +
            (lane4pct / 100) * 25 +
            (lane2pct / 100) * (isPeak ? 50 : 10) +
            (narrowpct / 100) * 0;

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

        // Traffic
        let traffic;
        if (serverTrafficLevel) {
            const MAP = {
                'Low': { label: 'LOW', cls: 'traf-low' },
                'Medium': { label: 'MEDIUM', cls: 'traf-medium' },
                'High': { label: 'HIGH', cls: 'traf-high' }
            };
            traffic = MAP[serverTrafficLevel] || computeTraffic(tb, new Date().getHours());
        } else {
            traffic = computeTraffic(tb, new Date().getHours());
        }
        trafficBadge.textContent = traffic.label;
        trafficBadge.className = 'traffic-badge ' + traffic.cls;
        trafficBanner.className = 'traffic-banner ' + traffic.cls;

        // Show the advanced section
        advSection.style.display = 'block';
    }
});
