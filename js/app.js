document.addEventListener('DOMContentLoaded', () => {
    // Initialize PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(req => console.log('Service Worker Registered'))
                .catch(err => console.log('Service Worker Error', err));
        });
    }

    // Initialize App Components
    const storage = new Storage();
    const ui = new UI(storage);

    // Expose for Global Access (e.g. from generated HTML)
    window.app = {
        storage,
        ui
    };
});

// Fullscreen Summary Logic
window.toggleSummaryFullscreen = function() {
    const wrapper = document.getElementById('daily-summary-wrapper');
    const btn = document.querySelector('#daily-summary-wrapper .icon-btn-sm');
    const icon = btn.querySelector('i');
    
    if (wrapper.classList.contains('fullscreen-mode')) {
        // Exit fullscreen
        wrapper.classList.remove('fullscreen-mode');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        document.body.style.overflow = '';
        if (history.state && history.state.fullscreen) {
            history.back(); // Pop the state if it was created by us
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

window.addEventListener('popstate', (e) => {
    const wrapper = document.getElementById('daily-summary-wrapper');
    if (wrapper && wrapper.classList.contains('fullscreen-mode')) {
        // Exited via back button
        const btn = document.querySelector('#daily-summary-wrapper .icon-btn-sm');
        const icon = btn.querySelector('i');
        wrapper.classList.remove('fullscreen-mode');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        document.body.style.overflow = '';
    }
});
