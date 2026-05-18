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
