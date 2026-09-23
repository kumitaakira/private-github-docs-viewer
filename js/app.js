import { initDocsViewerApp } from './features/app/docsViewerApp.js';

initDocsViewerApp();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
    });
}
