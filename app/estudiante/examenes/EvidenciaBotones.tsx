"use client";

import { useState } from "react";
import { Eye, X, CheckCircle, FileText } from "lucide-react";

interface EvidenciaModalProps {
  exam: {
    id: string;
    title: string;
    course: { name: string };
  };
  submission: {
    grade?: number | null;
    status: string;
    fileUrl?: string | null;
    submittedAt?: Date | null;
  };
  isGoogleForm: boolean;
}

export default function EvidenciaBotones({ exam, submission, isGoogleForm }: EvidenciaModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2 w-full md:items-end">
        <button 
          onClick={() => setIsOpen(true)}
          className="btn flex items-center justify-center gap-2 w-full md:w-auto hover:opacity-90 transition-opacity" 
          style={{ backgroundColor: '#4facfe', color: 'white' }}
        >
          <Eye size={16} />
          Visualizar Evidencia
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in" style={{ animation: "fade-in 0.2s ease-out" }}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FileText size={20} className="text-blue-500" />
                Evidencia de Examen
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">{exam.title}</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">Materia: {exam.course.name}</p>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-500" />
                  Calificación: {submission.grade !== null && submission.grade !== undefined ? <span className="font-bold text-xl">{submission.grade}</span> : <span className="italic font-normal">Pendiente de calificar</span>}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Fecha de entrega: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('es-CO') : 'No disponible'}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                {isGoogleForm ? (
                  <p>
                    Las respuestas detalladas de este examen están registradas en Google Forms. 
                    Revisa tu correo electrónico para ver el comprobante que Google envía automáticamente.
                  </p>
                ) : submission.fileUrl ? (
                  <div className="flex flex-col gap-2 items-start">
                    <p>Has adjuntado un archivo con tus respuestas.</p>
                    <a href={submission.fileUrl} target="_blank" className="px-4 py-2 mt-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 rounded-md font-medium transition-colors text-sm">
                      Ver archivo original
                    </a>
                  </div>
                ) : (
                  <p>
                    No se encontró un archivo adjunto ni un formulario enlazado a esta entrega.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
