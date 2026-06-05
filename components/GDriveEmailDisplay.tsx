"use client";

import { useEffect, useState } from "react";

interface GDriveEmailDisplayProps {
  email: string | null | undefined;
  className?: string;
  label?: string; // Por ejemplo "Almacenado en: " o similar
}

export default function GDriveEmailDisplay({ email, className = "", label = "" }: GDriveEmailDisplayProps) {
  const [showEmails, setShowEmails] = useState(true);

  useEffect(() => {
    // Leer valor inicial
    const val = localStorage.getItem("show_gdrive_emails") !== "false";
    setShowEmails(val);

    // Escuchar cambios de localStorage en la misma página o en otras pestañas
    const handleStorageChange = () => {
      const currentVal = localStorage.getItem("show_gdrive_emails") !== "false";
      setShowEmails(currentVal);
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Para capturar eventos locales dentro de la misma pestaña
    window.addEventListener("gdrive_emails_visibility_changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("gdrive_emails_visibility_changed", handleStorageChange);
    };
  }, []);

  if (!email) return null;

  return (
    <span className={`text-[10px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5 ${className}`} title="Almacenamiento de Google Drive">
      <span>☁️ {label}</span>
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {showEmails ? email : "Google Drive"}
      </span>
    </span>
  );
}
