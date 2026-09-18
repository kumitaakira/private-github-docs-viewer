const MERMAID_FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';

let renderSequence = 0;
let renderGeneration = 0;
let lightbox = null;

function themeVariables(isDark) {
    if (isDark) {
        return {
            background: '#0e1116',
            primaryColor: '#1b3032',
            primaryTextColor: '#e6edf3',
            primaryBorderColor: '#4fd1c5',
            secondaryColor: '#25213a',
            secondaryTextColor: '#e6edf3',
            secondaryBorderColor: '#a78bfa',
            tertiaryColor: '#151a21',
            tertiaryTextColor: '#e6edf3',
            tertiaryBorderColor: '#33404e',
            lineColor: '#91a0af',
            textColor: '#e6edf3',
            mainBkg: '#1b3032',
            nodeBorder: '#4fd1c5',
            clusterBkg: '#151a21',
            clusterBorder: '#33404e',
            edgeLabelBackground: '#0e1116',
            actorBkg: '#1b3032',
            actorBorder: '#4fd1c5',
            actorTextColor: '#e6edf3',
            signalColor: '#91a0af',
            signalTextColor: '#e6edf3',
            labelBoxBkgColor: '#151a21',
            labelBoxBorderColor: '#33404e',
            labelTextColor: '#e6edf3',
            loopTextColor: '#e6edf3',
            noteBkgColor: '#302c19',
            noteBorderColor: '#f6e05e',
            noteTextColor: '#e6edf3',
            activationBkgColor: '#25213a',
            activationBorderColor: '#a78bfa'
        };
    }

    return {
        background: '#faf7f0',
        primaryColor: '#fff3e4',
        primaryTextColor: '#2b2a26',
        primaryBorderColor: '#b45309',
        secondaryColor: '#f2eafb',
        secondaryTextColor: '#2b2a26',
        secondaryBorderColor: '#7c3aed',
        tertiaryColor: '#fffdf8',
        tertiaryTextColor: '#2b2a26',
        tertiaryBorderColor: '#d8cebd',
        lineColor: '#71685e',
        textColor: '#2b2a26',
        mainBkg: '#fff3e4',
        nodeBorder: '#b45309',
        clusterBkg: '#fffdf8',
        clusterBorder: '#d8cebd',
        edgeLabelBackground: '#faf7f0',
        actorBkg: '#fff3e4',
        actorBorder: '#b45309',
        actorTextColor: '#2b2a26',
        signalColor: '#71685e',
        signalTextColor: '#2b2a26',
        labelBoxBkgColor: '#fffdf8',
        labelBoxBorderColor: '#d8cebd',
        labelTextColor: '#2b2a26',
        loopTextColor: '#2b2a26',
        noteBkgColor: '#fff4bf',
        noteBorderColor: '#c18b1c',
        noteTextColor: '#3a3020',
        activationBkgColor: '#f2eafb',
        activationBorderColor: '#7c3aed'
    };
}

function initializeMermaid(isDark) {
    if (!window.mermaid) throw new Error('Mermaidの読み込みに失敗しました。');
    window.mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'strict',
        fontFamily: MERMAID_FONT,
        suppressErrorRendering: true,
        maxTextSize: 90000,
        themeVariables: themeVariables(isDark),
        flowchart: { htmlLabels: true, curve: 'basis', padding: 14 },
        sequence: { useMaxWidth: true, wrap: true, diagramMarginX: 24, diagramMarginY: 16 }
    });
}

function cleanupTemporaryNodes(id) {
    [id, `d${id}`].forEach((candidateId) => {
        const candidate = document.getElementById(candidateId);
        if (candidate && !candidate.closest('[data-mermaid-diagram]')) candidate.remove();
    });
}

function ensureLightbox() {
    if (lightbox?.isConnected) return lightbox;

    lightbox = document.createElement('div');
    lightbox.className = 'mermaid-lightbox';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Mermaid図の拡大表示');
    lightbox.innerHTML = '<div class="mermaid-lightbox-content"></div>';
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeMermaidLightbox();
    });
    document.body.appendChild(lightbox);
    return lightbox;
}

function openMermaidLightbox(svg) {
    const overlay = ensureLightbox();
    overlay.querySelector('.mermaid-lightbox-content').innerHTML = svg;
    overlay.hidden = false;
    document.documentElement.classList.add('mermaid-lightbox-open');
    document.body.classList.add('mermaid-lightbox-open');
}

export function closeMermaidLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightbox.querySelector('.mermaid-lightbox-content').replaceChildren();
    document.documentElement.classList.remove('mermaid-lightbox-open');
    document.body.classList.remove('mermaid-lightbox-open');
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) closeMermaidLightbox();
});

async function renderDiagram(container, isDark, generation) {
    const source = container.querySelector('.mermaid-source code')?.textContent.trim() || '';
    const stage = container.querySelector('.mermaid-stage');
    const status = container.querySelector('.mermaid-status');
    if (!source || !stage || !status) return;

    const id = `repo-mermaid-${renderSequence++}`;
    container.classList.remove('has-error');
    status.textContent = '';

    try {
        await window.mermaid.parse(source);
        const result = await window.mermaid.render(id, source);
        if (generation !== renderGeneration || !container.isConnected) return;

        stage.innerHTML = result.svg;
        container.classList.add('is-rendered');
        stage.onclick = () => openMermaidLightbox(result.svg);
        stage.onkeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openMermaidLightbox(result.svg);
        };
        result.bindFunctions?.(stage);
    } catch (error) {
        if (generation !== renderGeneration || !container.isConnected) return;
        stage.replaceChildren();
        stage.onclick = null;
        stage.onkeydown = null;
        container.classList.remove('is-rendered');
        container.classList.add('has-error');
        status.textContent = `Mermaidを描画できません: ${String(error?.message || error).split('\n')[0]}`;
    } finally {
        cleanupTemporaryNodes(id);
    }
}

/**
 * Render every Mermaid fence within a Markdown root, using the current UI theme.
 * A generation token prevents a slow older render from replacing a newer one.
 *
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
export async function renderMermaidDiagrams(root) {
    if (!root || !window.mermaid) return;
    const diagrams = [...root.querySelectorAll('[data-mermaid-diagram]')];
    if (diagrams.length === 0) return;

    const generation = ++renderGeneration;
    const isDark = document.documentElement.classList.contains('dark');
    initializeMermaid(isDark);

    // Mermaid's global configuration and temporary DOM are shared, so render
    // sequentially to prevent IDs and theme state from racing each other.
    for (const diagram of diagrams) {
        await renderDiagram(diagram, isDark, generation);
    }
}
