"use client";

import { useEffect, useState } from "react";

interface GDriveVisibilityToggleProps {
  context?: string;
}

export default function GDriveVisibilityToggle({ context = "global" }: GDriveVisibilityToggleProps) {
  const [showEmails, setShowEmails] = useState(true);
  const localStorageKey = `show_gdrive_emails_${context}`;
  const customEventName = `gdrive_emails_visibility_changed_${context}`;

  useEffect(() => {
    const val = localStorage.getItem(localStorageKey) !== "false";
    setShowEmails(val);

    const handleStorageChange = () => {
      const currentVal = localStorage.getItem(localStorageKey) !== "false";
      setShowEmails(currentVal);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(customEventName, handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(customEventName, handleStorageChange);
    };
  }, [localStorageKey, customEventName]);

  const toggleVisibility = () => {
    const nextVal = !showEmails;
    localStorage.setItem(localStorageKey, String(nextVal));
    setShowEmails(nextVal);

    // Disparar evento personalizado para actualizar los componentes de la misma pestaña inmediatamente
    const event = new Event(customEventName);
    window.dispatchEvent(event);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-200/60 dark:border-zinc-800/80 rounded-lg px-3 py-1.5 text-xs font-semibold select-none shadow-sm">
      <span className="text-muted dark:text-zinc-300">Mostrar correos de Drive</span>
      <button
        type="button"
        onClick={toggleVisibility}
        className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
        style={{
          width: "34px",
          height: "18px",
          borderRadius: "9999px",
          background: showEmails ? "var(--primary-color, #2563eb)" : "#cbd5e1",
          border: "none",
          padding: 0,
          outline: "none"
        }}
      >
        <span
          className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
          style={{
            width: "14px",
            height: "14px",
            transform: showEmails ? "translateX(18px)" : "translateX(2px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
          }}
        />
      </button>
    </div>
  );
}

