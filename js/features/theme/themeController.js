export class ThemeController {
    /**
     * @param {{ themeToggleIcon: HTMLElement, mdStyle: HTMLLinkElement, hlStyle: HTMLLinkElement, onChange?: (isDark: boolean) => void }} options
     */
    constructor({ themeToggleIcon, mdStyle, hlStyle, onChange = () => {} }) {
        this.themeToggleIcon = themeToggleIcon;
        this.mdStyle = mdStyle;
        this.hlStyle = hlStyle;
        this.onChange = onChange;
    }

    /**
     * Apply light or dark mode and sync dependent stylesheet URLs.
     *
     * @param {boolean} isDark
     */
    apply(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
            this.themeToggleIcon.textContent = 'light_mode';
            this.mdStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-dark.min.css';
            this.hlStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
            localStorage.setItem('theme_preference', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            this.themeToggleIcon.textContent = 'dark_mode';
            this.mdStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-light.min.css';
            this.hlStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
            localStorage.setItem('theme_preference', 'light');
        }
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = isDark ? '#0e1116' : '#faf7f0';
        this.onChange(isDark);
    }

    /**
     * Apply the saved theme preference, defaulting to dark.
     */
    applySavedTheme() {
        const savedTheme = localStorage.getItem('theme_preference') || 'dark';
        this.apply(savedTheme === 'dark');
    }

    /**
     * Toggle between light and dark mode.
     */
    toggle() {
        this.apply(!document.documentElement.classList.contains('dark'));
    }
}
