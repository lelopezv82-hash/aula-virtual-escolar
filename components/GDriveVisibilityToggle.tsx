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
      <label className="relative inline-flex items-center cursor-pointer select-none">
        <input 
          type="checkbox" 
          checked={showEmails}
          onChange={toggleVisibility}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-250 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f98012]"></div>
      </label>
    </div>
  );
}

