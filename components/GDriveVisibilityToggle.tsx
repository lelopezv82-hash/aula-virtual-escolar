"use client";

import { useEffect, useState } from "react";

export default function GDriveVisibilityToggle() {
  const [showEmails, setShowEmails] = useState(true);

  useEffect(() => {
    const val = localStorage.getItem("show_gdrive_emails") !== "false";
    setShowEmails(val);

    const handleStorageChange = () => {
      const currentVal = localStorage.getItem("show_gdrive_emails") !== "false";
      setShowEmails(currentVal);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("gdrive_emails_visibility_changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("gdrive_emails_visibility_changed", handleStorageChange);
    };
  }, []);

  const toggleVisibility = () => {
    const nextVal = !showEmails;
    localStorage.setItem("show_gdrive_emails", String(nextVal));
    setShowEmails(nextVal);

    // Disparar evento personalizado para actualizar los componentes de la misma pestaña inmediatamente
    const event = new Event("gdrive_emails_visibility_changed");
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
