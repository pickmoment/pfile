import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToastStore } from '../../store/useToastStore';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 bg-[#1e2230] border border-slate-700/80 text-slate-100 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md max-w-sm animate-in slide-in-from-bottom-3 duration-200"
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />}
          {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />}
          {(!t.type || t.type === 'info') && <Info className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />}

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-100">{t.title}</h4>
            {t.description && (
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug break-words">
                {t.description}
              </p>
            )}
          </div>

          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded hover:bg-slate-700/50 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
