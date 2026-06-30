import { Bell } from "lucide-react";

export default function AvisosPage() {
  return (
    <div className="card text-center py-12 text-muted">
      <Bell size={44} className="mx-auto mb-4 opacity-40" />
      <p className="font-semibold">No hay avisos publicados todavía.</p>
      <p className="text-sm mt-1">El docente publicará avisos importantes aquí.</p>
    </div>
  );
}
