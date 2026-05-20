document.addEventListener('DOMContentLoaded', async () => {
    // Initialize PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(req => console.log('Service Worker Registered'))
                .catch(err => console.log('Service Worker Error', err));
        });
    }

    // Initialize Storage first — this opens IndexedDB and migrates
    // any old LocalStorage data automatically (one-time, silent).
    const storage = new Storage();

    // IMPORTANT: Wait for the DB to be fully ready before building the UI.
    // This guarantees that loadEntry() sees migrated data on first run.
    try {
        await storage._dbPromise;
        console.log('[App] IndexedDB ready');
    } catch (err) {
        console.error('[App] IndexedDB failed to open — app may not function correctly:', err);
    }

    const ui = new UI(storage);

    // Expose for Global Access (e.g. from inline onclick handlers in HTML)
    window.app = { storage, ui };
});

// ─── Fullscreen Summary Logic ─────────────────────────────────────────────────
window.toggleSummaryFullscreen = function () {
    const wrapper = document.getElementById('daily-summary-wrapper');
    const btn  = document.querySelector('#daily-summary-wrapper .icon-btn-sm');
    const icon = btn.querySelector('i');

    if (wrapper.classList.contains('fullscreen-mode')) {
        // Exit fullscreen
        wrapper.classList.remove('fullscreen-mode');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        document.body.style.overflow = '';
        if (history.state && history.state.fullscreen) {
            history.back();
        }
    } else {
        // Enter fullscreen
        wrapper.classList.add('fullscreen-mode');
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        document.body.style.overflow = 'hidden';
        history.pushState({ fullscreen: true }, '', '#fullscreen');
    }
};

window.addEventListener('popstate', () => {
    const wrapper = document.getElementById('daily-summary-wrapper');
    if (wrapper && wrapper.classList.contains('fullscreen-mode')) {
        const btn  = document.querySelector('#daily-summary-wrapper .icon-btn-sm');
        const icon = btn.querySelector('i');
        wrapper.classList.remove('fullscreen-mode');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        document.body.style.overflow = '';
    }
});
