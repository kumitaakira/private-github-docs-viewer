import { ensureMermaid } from '../core/dependencyLoader.js';

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
            titleColor: '#e6edf3',
            nodeTextColor: '#e6edf3',
            classText: '#e6edf3',
            labelColor: '#e6edf3',
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
            activationBorderColor: '#a78bfa',
            taskTextColor: '#e6edf3',
            taskTextOutsideColor: '#e6edf3',
            activeTaskTextColor: '#0e1116',
            doneTaskTextColor: '#e6edf3',
            critTextColor: '#0e1116',
            sectionBkgColor: '#1b3032',
            sectionBkgColor2: '#25213a',
            altSectionBkgColor: '#151a21',
            gridColor: '#33404e',
            pieTitleTextColor: '#e6edf3',
            pieSectionTextColor: '#0e1116',
            pieLegendTextColor: '#e6edf3',
            stateLabelColor: '#e6edf3'
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
        titleColor: '#2b2a26',
        nodeTextColor: '#2b2a26',
        classText: '#2b2a26',
        labelColor: '#2b2a26',
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
        activationBorderColor: '#7c3aed',
        taskTextColor: '#2b2a26',
        taskTextOutsideColor: '#2b2a26',
        activeTaskTextColor: '#2b2a26',
        doneTaskTextColor: '#565149',
        critTextColor: '#2b2a26',
        sectionBkgColor: '#fff3e4',
        sectionBkgColor2: '#f2eafb',
        altSectionBkgColor: '#fffdf8',
        gridColor: '#d8cebd',
        pieTitleTextColor: '#2b2a26',
        pieSectionTextColor: '#2b2a26',
        pieLegendTextColor: '#2b2a26',
        stateLabelColor: '#2b2a26'
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

function normalizeMermaidSource(source) {
    // Mermaid quoted labels do not accept backslash-escaped quotes, although
    // they are common in Markdown examples containing source-code snippets.
    return source.replace(/\\"/g, '&quot;');
}

function parseOpaqueColor(color) {
    if (!color || color === 'none' || color === 'transparent') return null;
    const match = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/i);
    if (!match || (match[4] !== undefined && Number(match[4]) === 0)) return null;
    return match.slice(1, 4).map(Number);
}

function readableTextColor(background, fallback) {
    const rgb = parseOpaqueColor(background);
    if (!rgb) return fallback;
    const linear = rgb.map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
    return luminance > 0.36 ? '#18232d' : '#f7fafc';
}

function fitClusterLabels(stage) {
    stage.querySelectorAll('g.cluster').forEach((cluster) => {
        const rect = [...cluster.children].find(child => child.matches?.('rect'));
        const labelGroup = cluster.querySelector(':scope > .cluster-label');
        const foreignObject = labelGroup?.querySelector('foreignObject');
        const content = foreignObject?.firstElementChild;
        if (!rect || !labelGroup || !foreignObject || !content) return;

        const rectX = Number(rect.getAttribute('x')) || 0;
        const rectY = Number(rect.getAttribute('y')) || 0;
        const rectWidth = Number(rect.getAttribute('width')) || 0;
        const horizontalPadding = 12;
        const availableWidth = Math.max(80, rectWidth - (horizontalPadding * 2));

        labelGroup.setAttribute('transform', `translate(${rectX + horizontalPadding}, ${rectY})`);
        foreignObject.setAttribute('width', String(availableWidth));
        foreignObject.style.setProperty('overflow', 'visible');
        content.style.setProperty('display', 'block');
        content.style.setProperty('width', `${availableWidth}px`, 'important');
        content.style.setProperty('max-width', 'none', 'important');
        content.style.setProperty('white-space', 'nowrap', 'important');
        content.style.setProperty('line-height', '1.25', 'important');
        content.style.setProperty('font-size', '14px', 'important');

        const naturalWidth = content.scrollWidth;
        const fontSize = naturalWidth > availableWidth
            ? Math.max(11, 14 * (availableWidth / naturalWidth))
            : 14;
        const labelHeight = Math.ceil(fontSize * 1.25) + 2;

        content.style.setProperty('font-size', `${fontSize}px`, 'important');
        content.querySelectorAll('*').forEach((element) => {
            element.style.setProperty('font-size', 'inherit', 'important');
            element.style.setProperty('line-height', 'inherit', 'important');
        });
        foreignObject.setAttribute('height', String(labelHeight));
    });
}

function improveNodeTextContrast(stage, isDark) {
    const fallback = isDark ? '#e6edf3' : '#2b2a26';
    const groups = stage.querySelectorAll([
        'g.node',
        'g.cluster',
        'g.actor',
        'g.entityBox',
        'g[class*="stateGroup"]',
        'g[class*="requirement"]'
    ].join(','));

    groups.forEach((group) => {
        const shape = [...group.children].find(child => child.matches?.('rect, circle, ellipse, polygon, path'));
        if (!shape) return;
        const color = readableTextColor(getComputedStyle(shape).fill, fallback);

        group.querySelectorAll('text, tspan').forEach((element) => {
            element.style.setProperty('fill', color, 'important');
        });
        group.querySelectorAll('foreignObject, foreignObject *').forEach((element) => {
            element.style.setProperty('color', color, 'important');
            element.style.setProperty('-webkit-text-fill-color', color, 'important');
        });
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
    const rawSource = container.querySelector('.mermaid-source code')?.textContent.trim() || '';
    const source = normalizeMermaidSource(rawSource);
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
        fitClusterLabels(stage);
        improveNodeTextContrast(stage, isDark);
        container.classList.add('is-rendered');
        const renderedSvg = stage.querySelector('svg')?.outerHTML || result.svg;
        stage.onclick = () => openMermaidLightbox(renderedSvg);
        stage.onkeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openMermaidLightbox(renderedSvg);
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
    if (!root) return;
    const diagrams = [...root.querySelectorAll('[data-mermaid-diagram]')];
    if (diagrams.length === 0) return;

    try {
        await ensureMermaid();
    } catch (error) {
        diagrams.forEach(diagram => {
            diagram.classList.add('has-error');
            const status = diagram.querySelector('.mermaid-status');
            if (status) status.textContent = 'Mermaidライブラリを読み込めませんでした。';
        });
        return;
    }

    const generation = ++renderGeneration;
    const isDark = document.documentElement.classList.contains('dark');
    initializeMermaid(isDark);

    // Mermaid's global configuration and temporary DOM are shared, so render
    // sequentially to prevent IDs and theme state from racing each other.
    for (const diagram of diagrams) {
        await renderDiagram(diagram, isDark, generation);
    }
}
