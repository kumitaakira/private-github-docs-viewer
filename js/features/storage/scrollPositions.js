const MAX_ENTRIES = 100;

export class ScrollPositionStore {
    constructor(key) {
        this.key = key;
    }

    getEntryKey(settings, file) {
        return `${settings.repo}:${settings.path || ''}:${file.path}:${file.sha || ''}`;
    }

    readAll() {
        try {
            const value = JSON.parse(localStorage.getItem(this.key) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (error) {
            return {};
        }
    }

    get(settings, file) {
        const entry = this.readAll()[this.getEntryKey(settings, file)];
        return Number.isFinite(entry?.top) ? Math.max(0, entry.top) : 0;
    }

    save(settings, file, top) {
        if (!file?.path || !Number.isFinite(top)) return;
        try {
            const positions = this.readAll();
            positions[this.getEntryKey(settings, file)] = { top: Math.max(0, top), updatedAt: Date.now() };
            const trimmed = Object.fromEntries(
                Object.entries(positions)
                    .sort(([, a], [, b]) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
                    .slice(0, MAX_ENTRIES)
            );
            localStorage.setItem(this.key, JSON.stringify(trimmed));
        } catch (error) {
            // Scroll restoration is best-effort when storage is unavailable.
        }
    }
}
