"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export default function LogoutButton() {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;

    const ok = await confirm({
      title: "Cerrar Sesión",
      message: "¿Estás seguro de que deseas cerrar sesión?",
      confirmText: "Cerrar Sesión",
      type: "warning",
    });

    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="logout-btn font-medium text-sm text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
      disabled={loading}
      title="Cerrar sesión"
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.25rem 0.5rem",
      }}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin" /> Cerrando...
        </span>
      ) : (
        "Cerrar sesión"
      )}
    </button>
  );
}
