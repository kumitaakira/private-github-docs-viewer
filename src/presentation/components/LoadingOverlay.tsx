type LoadingOverlayProps = {
  visible: boolean;
  onCancel?: () => void;
};

export function LoadingOverlay({ visible, onCancel }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-dracula-bg/80">
      <div className="flex flex-col items-center gap-3">
        <div className="waiting-orbit" aria-hidden="true">
          <span className="waiting-dot" />
          <span className="waiting-dot" />
          <span className="waiting-dot" />
        </div>
        <div className="text-xs font-medium tracking-wide text-gray-500 dark:text-dracula-comment">
          待機中...
        </div>
        {onCancel ? (
          <button
            className="rounded px-3 py-1 text-xs text-gray-500 transition-colors hover:text-gray-800 dark:text-dracula-comment dark:hover:text-dracula-fg"
            type="button"
            onClick={onCancel}
          >
            キャンセル
          </button>
        ) : null}
      </div>
    </div>
  );
}
