"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Eye, EyeOff } from "lucide-react";

interface Student {
  id: string;
  name: string;
  username: string;
  grade: string | null;
  groupName: string | null;
  passwordPlain?: string | null;
}

export default function EstudiantesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docente/estudiantes");
      const data = await res.json();
      if (data.students) setStudents(data.students);
    } catch (err) {
      console.error("Error loading students:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.grade || "").includes(search) ||
    (s.groupName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1>Listado de Estudiantes</h1>
          <p>Visualiza el listado de alumnos registrados, sus grupos y credenciales de acceso.</p>
        </div>
      </div>

      <div className="card w-full">
        <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
          <div style={{ position: "relative", maxWidth: "320px", width: "100%" }}>
            <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: "2.75rem" }}
              placeholder="Buscar por nombre, usuario, grado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-muted text-sm">{filtered.length} estudiante(s)</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th className="py-3 px-4 font-medium">Nombre</th>
                  <th className="py-3 px-4 font-medium">Usuario</th>
                  <th className="py-3 px-4 font-medium">Contraseña</th>
                  <th className="py-3 px-4 font-medium">Curso / Grupo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-muted">
                      {search ? "No se encontraron resultados." : "No hay estudiantes registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((student) => (
                    <tr key={student.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td className="py-3 px-4 font-medium">{student.name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{student.username}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {student.passwordPlain ? (
                              visiblePasswords[student.id] ? student.passwordPlain : "••••••••"
                            ) : (
                              <span className="text-muted italic text-xs">No disponible</span>
                            )}
                          </span>
                          {student.passwordPlain && (
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                              className="p-1 rounded text-muted hover:text-primary hover:bg-gray-100 transition-colors"
                              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "0.25rem" }}
                              title={visiblePasswords[student.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {visiblePasswords[student.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {(student.grade || student.groupName) ? (
                          <span className="badge badge-info">
                            {student.grade ? `Grado ${student.grade}` : ""}
                            {student.grade && student.groupName ? " – " : ""}
                            {student.groupName || ""}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
