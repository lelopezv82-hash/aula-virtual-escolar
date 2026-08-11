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
      className="flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-red-100"
      disabled={loading}
      title="Cerrar sesión"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-red-500" /> Cerrando...
        </span>
      ) : (
        <>
          <div className="flex items-center justify-center p-1.5 rounded-md bg-gray-100 text-gray-500 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-log-out"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </div>
          <span>Cerrar sesión</span>
        </>
      )}
    </button>
  );
}
