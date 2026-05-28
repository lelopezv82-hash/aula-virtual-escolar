import React from 'react';
import { X, AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
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
          iconBg: 'rgba(239, 68, 68, 0.1)',
          iconColor: '#ef4444',
          btnBg: '#ef4444',
          btnBgHover: '#dc2626',
          btnShadow: '0 0 12px rgba(239, 68, 68, 0.3)'
        };
      case 'warning':
        return {
          iconBg: 'rgba(245, 158, 11, 0.1)',
          iconColor: '#f59e0b',
          btnBg: '#f59e0b',
          btnBgHover: '#d97706',
          btnShadow: '0 0 12px rgba(245, 158, 11, 0.3)'
        };
      case 'info':
      default:
        return {
          iconBg: 'rgba(37, 99, 235, 0.1)',
          iconColor: '#2563eb',
          btnBg: '#2563eb',
          btnBgHover: '#1d4ed8',
          btnShadow: '0 0 12px rgba(37, 99, 235, 0.3)'
        };
    }
  };

  const colors = getThemeColor();

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 size={26} color={colors.iconColor} />;
      case 'warning':
        return <AlertTriangle size={26} color={colors.iconColor} />;
      case 'info':
      default:
        return <Info size={26} color={colors.iconColor} />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '1rem'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg), 0 20px 25px -5px rgba(0, 0, 0, 0.15)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          position: 'relative'
        }}
      >
        {/* Header Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div style={{ padding: '2rem 1.75rem 1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
            {/* Icon Wrapper */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: colors.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {getIcon()}
            </div>

            {/* Texts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: '0.925rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.45rem'
                }}
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '1rem 1.5rem 1.25rem 1.5rem',
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'end',
            gap: '0.75rem'
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn"
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              backgroundColor: colors.btnBg,
              color: 'white',
              boxShadow: colors.btnShadow,
              transition: 'all 0.15s ease-in-out'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
