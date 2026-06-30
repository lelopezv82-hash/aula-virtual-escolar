"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
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
        router.push("/login");
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
      className="logout-btn"
      disabled={loading}
      title="Cerrar Sesión"
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.5rem",
        color: "inherit"
      }}
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
    </button>
  );
}
