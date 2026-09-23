const pendingScripts = new Map();
const pendingStyles = new Map();

function loadScript(src, isReady) {
    if (isReady()) return Promise.resolve();
    if (pendingScripts.has(src)) return pendingScripts.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => isReady() ? resolve() : reject(new Error(`${src} を初期化できませんでした`));
        script.onerror = () => reject(new Error(`${src} を読み込めませんでした`));
        document.head.appendChild(script);
    }).catch(error => {
        pendingScripts.delete(src);
        throw error;
    });

    pendingScripts.set(src, promise);
    return promise;
}

function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    if (pendingStyles.has(href)) return pendingStyles.get(href);

    const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`${href} を読み込めませんでした`));
        document.head.appendChild(link);
    }).catch(error => {
        pendingStyles.delete(href);
        throw error;
    });

    pendingStyles.set(href, promise);
    return promise;
}

export async function ensurePdfJs() {
    await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        () => Boolean(window.pdfjsLib)
    );
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return window.pdfjsLib;
}

export async function ensureMermaid() {
    await loadScript(
        'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
        () => Boolean(window.mermaid)
    );
    return window.mermaid;
}

export async function ensureMathDependencies() {
    await Promise.all([
        loadStyle('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css'),
        loadScript(
            'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js',
            () => Boolean(window.katex)
        )
    ]);
    await loadScript(
        'https://cdn.jsdelivr.net/npm/markdown-it-texmath@1.0.0/texmath.min.js',
        () => Boolean(window.texmath)
    );
}

export function containsMathSyntax(markdown) {
    return /\$\$[\s\S]+?\$\$|(^|[^\\$])\$[^\s$][^\n$]*?\$/m.test(markdown);
}
