"use client";

import { useState } from "react";
import { Eye, X, CheckCircle, FileText, XCircle, CheckCircle2, CircleDot } from "lucide-react";

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
    feedback?: string | null;
  };
  isGoogleForm: boolean;
}

export default function EvidenciaBotones({ exam, submission, isGoogleForm }: EvidenciaModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Intentamos parsear las respuestas guardadas en feedback (que ahora deberían venir como JSON string)
  let answersData: { 
    question: string; 
    answer: string;
    isGradable?: boolean;
    score?: number | null;
    maxScore?: number | null;
    isCorrect?: boolean;
    correctAnswer?: string;
  }[] | null = null;
  if (isGoogleForm && submission.feedback) {
    try {
      const parsed = JSON.parse(submission.feedback);
      if (Array.isArray(parsed)) {
        answersData = parsed;
      }
    } catch (e) {
      // No es un JSON válido o es feedback antiguo del profesor
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 w-full md:items-end">
        <button 
          onClick={() => setIsOpen(true)}
          className="btn flex items-center justify-center gap-2 w-full md:w-auto hover:opacity-90 transition-opacity" 
          style={{ backgroundColor: '#4facfe', color: 'white' }}
        >
          <Eye size={16} />
          Ver Respuestas
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] shadow-2xl flex flex-col animate-fade-in" style={{ animation: "fade-in 0.2s ease-out" }}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-t-xl shrink-0">
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
            
            <div className="p-6 overflow-y-auto grow">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 shrink-0">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">{exam.title}</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">Materia: {exam.course.name}</p>
              </div>

              <div className="mb-6 shrink-0">
                <p className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-500" />
                  Calificación: {submission.grade !== null && submission.grade !== undefined ? <span className="font-bold text-xl">{submission.grade}</span> : <span className="italic font-normal">Pendiente de calificar</span>}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Fecha de entrega: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('es-CO') : 'No disponible'}
                </p>
              </div>

              {answersData && answersData.length > 0 ? (
                <div className="mt-6 flex flex-col gap-4">
                  {answersData.map((item, index) => {
                    if (item.isGradable === false) {
                      // Estilo simple para preguntas no evaluables (ej. Nombre)
                      return (
                        <div key={index} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                          <p className="font-semibold text-gray-800 mb-4">{item.question}</p>
                          <p className="text-sm text-gray-600 border-b border-gray-300 pb-1">{item.answer}</p>
                        </div>
                      );
                    }

                    // Estilo Google Forms para preguntas evaluables
                    const isIncorrect = item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && !item.isCorrect;
                    const isCorrect = item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && item.isCorrect;

                    return (
                      <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        {/* Cabecera de la pregunta */}
                        <div className="p-5 flex gap-3 items-start relative">
                          {isIncorrect && <XCircle className="text-red-600 shrink-0 mt-0.5" size={20} />}
                          {isCorrect && <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />}
                          {(!isIncorrect && !isCorrect) && <div className="w-5 shrink-0" />} {/* Espaciador */}

                          <div className="flex-grow">
                            <div className="flex justify-between items-start mb-4">
                              <p className={`font-semibold text-base ${isIncorrect ? 'text-red-600' : isCorrect ? 'text-green-700' : 'text-gray-800'}`}>
                                {item.question}
                              </p>
                              {item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && (
                                <span className="text-xs font-medium text-gray-600 ml-4 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                                  {item.score || 0}/{item.maxScore}
                                </span>
                              )}
                            </div>

                            {/* Respuesta del estudiante */}
                            <div className={`p-3 rounded-md flex justify-between items-center ${isIncorrect ? 'bg-red-50' : isCorrect ? 'bg-green-50' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2">
                                <CircleDot size={16} className={isIncorrect ? 'text-red-500' : isCorrect ? 'text-green-600' : 'text-gray-500'} />
                                <span className="text-sm text-gray-800">{item.answer || <span className="italic text-gray-400">Sin responder</span>}</span>
                              </div>
                              {isIncorrect && <X className="text-red-500 shrink-0" size={18} />}
                              {isCorrect && <CheckCircle2 className="text-green-600 shrink-0" size={18} />}
                            </div>

                            {/* Respuesta Correcta (si se equivocó) */}
                            {isIncorrect && item.correctAnswer && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500 mb-2">Respuesta correcta</p>
                                <div className="flex items-center gap-2">
                                  <CircleDot size={16} className="text-gray-500" />
                                  <span className="text-sm text-gray-800">{item.correctAnswer}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 shrink-0">
                  {isGoogleForm ? (
                    <p>
                      Tu examen fue enviado con éxito a través de Google Forms y tus respuestas han sido registradas. 
                      Esta calificación ya es oficial en la plataforma. 
                      <br/><br/>
                      <span className="italic text-xs">(El detalle individual de respuestas no está disponible para entregas antiguas o anteriores a la actualización).</span>
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
                      No se encontró un archivo adjunto ni respuestas detalladas de un formulario enlazado a esta entrega.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end rounded-b-xl shrink-0">
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
