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
}

export default function ExportButtons({ taskTitle, courseName, dueDate, students, submissions }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = ["Estudiante", "Estado", "Fecha de Envío", "Calificación", "Retroalimentación"];
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
        const feedback = sub?.feedback || "";

        return [
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

      // Use BOM so Excel parses UTF-8 characters like accents and 'ñ' correctly
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const safeTitle = taskTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      link.setAttribute("download", `calificaciones_${safeTitle}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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
