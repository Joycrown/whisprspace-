'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => hideToast(id), toast.duration || 5000);
  }, [hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full px-4 md:px-0 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = {
    success: { icon: <CheckCircle className="w-4 h-4" />, accent: '#5DCAA5',  bg: 'rgba(93,202,165,0.08)',  border: 'rgba(93,202,165,0.25)'  },
    error:   { icon: <XCircle    className="w-4 h-4" />, accent: '#E24B4A',  bg: 'rgba(226,75,74,0.08)',   border: 'rgba(226,75,74,0.25)'   },
    warning: { icon: <AlertCircle className="w-4 h-4" />, accent: '#EF9F27', bg: 'rgba(239,159,39,0.08)',  border: 'rgba(239,159,39,0.25)'  },
    info:    { icon: <Info        className="w-4 h-4" />, accent: '#C4B5FD', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.25)'  },
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, x: 40 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.18 }}
      className="pointer-events-auto rounded-xl px-4 py-3 flex items-start gap-3 border-l-2"
      style={{
        background: `${config.bg}`,
        borderColor: config.accent,
        border: `1px solid ${config.border}`,
        borderLeftColor: config.accent,
        borderLeftWidth: 2,
        backdropFilter: 'none',
      }}
    >
      <span style={{ color: config.accent }} className="flex-shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#F2F2F6]">{toast.title}</p>
        {toast.message && <p className="text-xs text-[#8F8FA3] mt-0.5 leading-relaxed">{toast.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-[#5C5C6E] hover:text-[#F2F2F6] transition-colors mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function useToastHelpers() {
  const { showToast } = useToast();
  return {
    success: (title: string, message?: string) => showToast({ type: 'success', title, message }),
    error:   (title: string, message?: string) => showToast({ type: 'error',   title, message }),
    warning: (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    info:    (title: string, message?: string) => showToast({ type: 'info',    title, message }),
  };
}
