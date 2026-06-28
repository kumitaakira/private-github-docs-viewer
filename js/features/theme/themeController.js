export class ThemeController {
    /**
     * @param {{ themeToggleIcon: HTMLElement, mdStyle: HTMLLinkElement, hlStyle: HTMLLinkElement }} options
     */
    constructor({ themeToggleIcon, mdStyle, hlStyle }) {
        this.themeToggleIcon = themeToggleIcon;
        this.mdStyle = mdStyle;
        this.hlStyle = hlStyle;
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
            this.hlStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/dracula.min.css';
            localStorage.setItem('theme_preference', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            this.themeToggleIcon.textContent = 'dark_mode';
            this.mdStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-light.min.css';
            this.hlStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
            localStorage.setItem('theme_preference', 'light');
        }
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
