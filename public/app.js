// Main application logic

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-car-btn');
    const findPathBtn = document.getElementById('find-path-btn');
    const statusText = document.getElementById('status-text');

    startBtn.addEventListener('click', async () => {
        try {
            statusText.textContent = "Initiating Arduino connection...";
            const res = await fetch('http://localhost:3000/api/start-car', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                statusText.innerHTML = `<span style="color: #00e5ff;">Arduino Car Started successfully!</span>`;
            }
        } catch (error) {
            console.error(error);
            statusText.innerHTML = `<span style="color: #ff3366;">Error connecting to server. Is it running?</span>`;
        }
    });

    findPathBtn.addEventListener('click', async () => {
        const source = document.getElementById('source').value;
        const destination = document.getElementById('destination').value;
        const mode = document.getElementById('mode').value;
        const preference = document.getElementById('preference').value;

        if (source === destination) {
            statusText.textContent = "Source and Destination cannot be the same.";
            return;
        }

        statusText.textContent = "Calculating Optimal Route...";

        try {
            // We will add the real endpoint /api/path soon
            const res = await fetch(`http://localhost:3000/api/path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source, destination, mode, preference })
            });
            const data = await res.json();

            if (data.success) {
                statusText.innerHTML = `Path Found: Cost <b>${data.totalCost.toFixed(2)}</b><br><span style="font-size:0.8rem">${data.path.join(' ➔ ')}</span>`;

                // Highlight path via Map Renderer
                if (window.MapRenderer) {
                    window.MapRenderer.highlightPath(data.detailedPath);
                }
            } else {
                statusText.textContent = "No valid path found.";
            }

        } catch (error) {
            console.error(error);
            statusText.innerHTML = `<span style="color: #ff3366;">Ensure the API server is up and routing logic is implemented.</span>`;
        }
    });

    // Initial render
    if (window.MapRenderer) {
        window.MapRenderer.init();
    }
});
