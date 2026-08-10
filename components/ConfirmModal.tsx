import React from 'react';
import { X, AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  type = "danger"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getThemeColor = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-red-50 dark:bg-red-950/20 ring-4 ring-red-500/10',
          iconColor: 'text-red-500 dark:text-red-400',
          btnBg: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
          btnShadow: 'shadow-[0_4px_12px_rgba(239,68,68,0.2)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.3)]',
          icon: <Trash2 className="w-5.5 h-5.5" />
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 dark:bg-amber-950/20 ring-4 ring-amber-500/10',
          iconColor: 'text-amber-600 dark:text-amber-400',
          btnBg: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 focus:ring-amber-500',
          btnShadow: 'shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_6px_16px_rgba(245,158,11,0.3)]',
          icon: <AlertTriangle className="w-5.5 h-5.5" />
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-orange-50 dark:bg-orange-950/20 ring-4 ring-orange-500/10',
          iconColor: 'text-[#f98012] dark:text-[#f98012]',
          btnBg: 'bg-[#f98012] hover:bg-[#e06d09] dark:bg-[#e06d09] dark:hover:bg-[#f98012] focus:ring-[#f98012]',
          btnShadow: 'shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)]',
          icon: <Info className="w-5.5 h-5.5" />
        };
    }
  };

  const colors = getThemeColor();

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-md overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl animate-scale-in"
      >
        {/* Header Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all duration-150"
        >
          <X className="w-4 h-4" />
        </button>
 
        {/* Content */}
        <div className="p-6 pt-8 pb-5">
          <div className="flex gap-4 items-start">
            {/* Icon Wrapper with glowing rings */}
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 ${colors.iconBg} ${colors.iconColor}`}
            >
              {colors.icon}
            </div>
 
            {/* Texts */}
            <div className="flex-1 flex flex-col gap-1.5">
              <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white font-heading">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                {message}
              </p>
            </div>
          </div>
        </div>
 
        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/60">
          {cancelText !== null && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 ${colors.btnBg} ${colors.btnShadow}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
