interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-dark-lighter rounded-2xl overflow-hidden">
        {/* Content */}
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
          <p className="text-white/70">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex border-t border-gold/20">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-white/70 font-medium
                       hover:bg-dark-card transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 text-gold font-medium border-l border-gold/20
                       hover:bg-dark-card transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
