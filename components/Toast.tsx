"use client";

import { useEffect, useState, createContext, useContext, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (opts: Omit<ToastMessage, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Single Toast Item ──────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; progress: string }> = {
  success: {
    bg: "linear-gradient(135deg, #0f2027 0%, #0d3b2e 100%)",
    border: "rgba(52, 211, 153, 0.4)",
    icon: "#34d399",
    progress: "#34d399",
  },
  error: {
    bg: "linear-gradient(135deg, #1f0a0a 0%, #3b0d0d 100%)",
    border: "rgba(248, 113, 113, 0.4)",
    icon: "#f87171",
    progress: "#f87171",
  },
  warning: {
    bg: "linear-gradient(135deg, #1a1000 0%, #3b2a00 100%)",
    border: "rgba(251, 191, 36, 0.4)",
    icon: "#fbbf24",
    progress: "#fbbf24",
  },
  info: {
    bg: "linear-gradient(135deg, #060f2e 0%, #0d1f5c 100%)",
    border: "rgba(96, 165, 250, 0.4)",
    icon: "#60a5fa",
    progress: "#60a5fa",
  },
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 4000;
  const colors = COLORS[toast.type];
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Entrance animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        handleClose();
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 350);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minWidth: 300,
        maxWidth: 420,
        borderRadius: 14,
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`,
        overflow: "hidden",
        transform: visible ? "translateX(0) scale(1)" : "translateX(100%) scale(0.92)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        willChange: "transform, opacity",
      }}
    >
      {/* Body */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px 12px" }}>
        {/* Icon with glow */}
        <div
          style={{
            flexShrink: 0,
            color: colors.icon,
            marginTop: 1,
            filter: `drop-shadow(0 0 6px ${colors.icon}99)`,
          }}
        >
          {ICONS[toast.type]}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "'Inter', 'Outfit', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "#f1f5f9",
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
            }}
          >
            {toast.title}
          </p>
          {toast.message && (
            <p
              style={{
                margin: "3px 0 0",
                fontFamily: "'Inter', 'Outfit', sans-serif",
                fontSize: 12.5,
                color: "rgba(203,213,225,0.75)",
                lineHeight: 1.45,
              }}
            >
              {toast.message}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(148,163,184,0.6)",
            padding: 2,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            transition: "color 0.15s, background 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#f1f5f9";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)";
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progress}%`,
            background: colors.progress,
            boxShadow: `0 0 8px ${colors.progress}88`,
            transition: "width 0.1s linear",
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </div>
  );
}

// ── Toast Container ────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((opts: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { ...opts, id }]); // max 5 toasts
  }, []);

  const success = useCallback((title: string, message?: string) => showToast({ type: "success", title, message }), [showToast]);
  const error   = useCallback((title: string, message?: string) => showToast({ type: "error",   title, message }), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast({ type: "warning", title, message }), [showToast]);
  const info    = useCallback((title: string, message?: string) => showToast({ type: "info",    title, message }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}
