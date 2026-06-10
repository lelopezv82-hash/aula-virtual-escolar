"use client";

import { useState } from "react";
import { FileSpreadsheet, Printer, Check } from "lucide-react";

interface Student {
  id: string;
  name: string;
}

interface Submission {
  id: string;
  studentId: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  submittedAt: string | Date | null;
}

interface ExportButtonsProps {
  taskTitle: string;
  courseName: string;
  dueDate: string;
  students: Student[];
  submissions: Submission[];
  period?: string | null;
  gradeName?: string | null;
  groupName?: string | null;
  theme?: string | null;
}

export default function ExportButtons({ 
  taskTitle, 
  courseName, 
  students, 
  submissions,
  period,
  gradeName,
  groupName,
  theme
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = ["Periodo", "Grado", "Grupo", "Asignatura", "Tema", "Título", "Estudiante", "Estado", "Fecha de Envío", "Calificación", "Retroalimentación"];
      const rows = students.map(student => {
        const sub = submissions.find(s => s.studentId === student.id);
        
        let statusText = "Pendiente";
        if (sub) {
          if (sub.status === "GRADED") statusText = "Calificada";
          else if (sub.status === "SUBMITTED" || sub.status === "PENDING") {
            statusText = sub.submittedAt ? "Entregada" : "Pendiente";
          }
        }

        const grade = sub?.grade !== undefined && sub?.grade !== null ? sub.grade.toFixed(1) : "—";
        const date = sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString("es-CO") : "—";
        const feedback = (sub?.feedback && !sub.feedback.trim().startsWith("[")) ? sub.feedback : "";

        return [
          period || "Sin Periodo",
          gradeName || "Sin Grado",
          groupName || "Sin Grupo",
          courseName,
          theme || "Sin Tema",
          taskTitle,
          student.name,
          statusText,
          date,
          grade,
          feedback
        ];
      });

      // Escape fields for CSV format
      const csvContent = [
        headers,
        ...rows
      ].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

      const safeTitle = taskTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const filename = `calificaciones_${safeTitle}.csv`;

      // Use BOM so Excel parses UTF-8 characters like accents and 'ñ' correctly
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Back up to Google Drive (silently)
      fetch("/api/docente/gdrive/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent,
          courseName,
          taskTitle,
          type: "grades",
          filename
        })
      }).catch(err => console.error("Error backing up to Google Drive:", err));

      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (err) {
      console.error("Error exporting CSV:", err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex gap-2 no-print">
      <button className="btn btn-secondary flex items-center gap-1.5 text-sm" onClick={exportCSV} disabled={exporting}>
        {exported ? <Check size={16} className="text-emerald-500" /> : <FileSpreadsheet size={16} />}
        {exported ? "¡Descargado!" : "Exportar Excel"}
      </button>
      <button className="btn btn-primary flex items-center gap-1.5 text-sm" onClick={handlePrint}>
        <Printer size={16} />
        Imprimir Reporte (PDF)
      </button>
    </div>
  );
}
