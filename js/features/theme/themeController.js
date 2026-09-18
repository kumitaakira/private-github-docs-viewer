const THEMES = {
    aurora: {
        isDark: true,
        themeColor: '#0e1116',
        highlightStyle: 'github-dark'
    },
    midnight: {
        isDark: true,
        themeColor: '#090f1d',
        highlightStyle: 'atom-one-dark'
    },
    paper: {
        isDark: false,
        themeColor: '#faf7f0',
        highlightStyle: 'github'
    },
    mist: {
        isDark: false,
        themeColor: '#f1f5f7',
        highlightStyle: 'atom-one-light'
    }
};

const THEME_ORDER = Object.keys(THEMES);

export class ThemeController {
    /**
     * @param {{ themeSelect: HTMLSelectElement, mdStyle: HTMLLinkElement, hlStyle: HTMLLinkElement, onChange?: (theme: { id: string, isDark: boolean }) => void }} options
     */
    constructor({ themeSelect, mdStyle, hlStyle, onChange = () => {} }) {
        this.themeSelect = themeSelect;
        this.mdStyle = mdStyle;
        this.hlStyle = hlStyle;
        this.onChange = onChange;
        this.currentTheme = 'aurora';
    }

    /**
     * Apply a named theme and sync dependent syntax/Markdown stylesheets.
     *
     * @param {string} themeId
     */
    apply(themeId) {
        const normalizedId = THEMES[themeId] ? themeId : 'aurora';
        const theme = THEMES[normalizedId];
        const root = document.documentElement;

        root.dataset.theme = normalizedId;
        root.classList.toggle('dark', theme.isDark);
        this.themeSelect.value = normalizedId;
        this.mdStyle.href = `https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-${theme.isDark ? 'dark' : 'light'}.min.css`;
        this.hlStyle.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme.highlightStyle}.min.css`;
        localStorage.setItem('theme_preference', normalizedId);
        this.currentTheme = normalizedId;

        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = theme.themeColor;
        this.onChange({ id: normalizedId, isDark: theme.isDark });
    }

    /**
     * Apply the saved theme, including migration from the former light/dark values.
     */
    applySavedTheme() {
        const savedTheme = localStorage.getItem('theme_preference') || 'aurora';
        const migratedTheme = savedTheme === 'dark' ? 'aurora' : savedTheme === 'light' ? 'paper' : savedTheme;
        this.apply(migratedTheme);
    }

    /**
     * Move to the next theme. Used by the keyboard shortcut.
     */
    cycle() {
        const currentIndex = THEME_ORDER.indexOf(this.currentTheme);
        this.apply(THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]);
    }
}
