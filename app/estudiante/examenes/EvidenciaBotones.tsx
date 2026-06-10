"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
    options?: string[];
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Bloquear scroll del body al abrir el modal
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const modalContent = isOpen && mounted ? createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
      {/* Botón flotante para cerrar FIJO en la pantalla */}
      <button 
        onClick={() => setIsOpen(false)}
        className="fixed top-4 right-4 md:top-6 md:right-6 z-[110] bg-white/20 hover:bg-white text-white hover:text-gray-800 rounded-full p-2 transition-all shadow-lg backdrop-blur-md"
        title="Cerrar"
      >
        <X size={28} />
      </button>

      <div className="min-h-screen p-4 py-16 md:py-20 flex justify-center items-start">
        <div className="bg-[#f0ebf8] rounded-lg w-full max-w-3xl shadow-2xl flex flex-col animate-fade-in relative mx-auto">
          <div className="px-4 py-8 md:px-12 md:py-16 lg:px-20 lg:py-20">
                
                {/* Header (Top Box) */}
                <div className="bg-white border border-[#dadce0] rounded-[8px] overflow-hidden mb-4 border-t-8 border-t-[#673ab7]">
                  <div className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <h1 className="text-[32px] text-[#202124] font-normal leading-tight">{exam.title}</h1>
                      
                      <div className="flex flex-col items-end shrink-0 gap-1 mt-2">
                        <span className="text-sm text-[#202124]">Puntos totales</span>
                        <div className="bg-[#673ab7] text-white px-3 py-1 rounded-[4px] font-medium text-sm">
                          {answersData ? (
                            `${answersData.reduce((sum, item) => sum + (item.score || 0), 0)}/${answersData.reduce((sum, item) => sum + (item.maxScore || 0), 0)}`
                          ) : (
                            submission.grade !== null ? submission.grade : '?'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preguntas */}
                {answersData && answersData.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {answersData.map((item, index) => {
                      if (item.isGradable === false) {
                        return (
                          <div key={index} className="bg-white p-6 rounded-[8px] border border-[#dadce0] shadow-sm">
                            <p className="text-base text-[#202124] mb-6">
                              {item.question} <span className="text-[#d93025]">*</span>
                            </p>
                            <div className="border-b border-[#dadce0] pb-1 w-full md:w-3/4">
                              <span className="text-[#202124]">{item.answer}</span>
                            </div>
                          </div>
                        );
                      }

                      const isIncorrect = item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && !item.isCorrect;
                      const isCorrect = item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && item.isCorrect;

                      return (
                        <div key={index} className="bg-white p-6 rounded-[8px] border border-[#dadce0] shadow-sm">
                          {/* Cabecera de la pregunta */}
                          <div className="flex justify-between items-start mb-4 gap-4">
                            <div className="flex items-start gap-3">
                              {isCorrect && <CheckCircle2 className="text-[#1e8e3e] shrink-0 mt-[2px]" size={20} />}
                              {isIncorrect && <X className="text-[#d93025] shrink-0 mt-[2px]" size={20} />}
                              {(!isIncorrect && !isCorrect) && <div className="w-5 shrink-0" />} 

                              <p className={`text-base ${isIncorrect ? 'text-[#d93025]' : isCorrect ? 'text-[#1e8e3e]' : 'text-[#202124]'}`}>
                                {item.question} <span className="text-[#d93025]">*</span>
                              </p>
                            </div>
                            
                            {item.maxScore !== null && item.maxScore !== undefined && item.maxScore > 0 && (
                              <span className="text-[14px] text-[#202124] shrink-0 mt-1">
                                {item.score || 0}/{item.maxScore}
                              </span>
                            )}
                          </div>

                          {/* Respuesta del estudiante y Opciones */}
                          <div className="mt-2">
                            {item.options && item.options.length > 0 ? (
                              <div className="flex flex-col gap-3">
                                {item.options.map((opt, optIndex) => {
                                  const isUserAnswer = opt === item.answer;
                                  
                                  let bgClass = "";
                                  if (isUserAnswer) {
                                    bgClass = isCorrect ? "bg-[#e6f4ea]" : "bg-[#fce8e6]";
                                  }
                                  
                                  return (
                                    <div key={optIndex} className={`px-4 py-3 rounded-[4px] flex justify-between items-center ${bgClass}`}>
                                      <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isUserAnswer ? 'border-[#5f6368]' : 'border-[#bdc1c6]'}`}>
                                          {isUserAnswer && <div className="w-2.5 h-2.5 rounded-full bg-[#5f6368]"></div>}
                                        </div>
                                        <span className="text-[14px] text-[#202124]">{opt}</span>
                                      </div>
                                      
                                      {isUserAnswer && isIncorrect && <X className="text-[#d93025] shrink-0" size={20} />}
                                      {isUserAnswer && isCorrect && <CheckCircle2 className="text-[#1e8e3e] shrink-0" size={20} />}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              // Fallback para entregas antiguas sin options
                              <div className={`px-4 py-3 rounded-[4px] flex justify-between items-center ${isIncorrect ? 'bg-[#fce8e6]' : isCorrect ? 'bg-[#e6f4ea]' : ''}`}>
                                <div className="flex items-center gap-3">
                                  {/* Radio button simulado */}
                                  <div className="w-5 h-5 rounded-full border-2 border-[#5f6368] flex items-center justify-center shrink-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#5f6368]"></div>
                                  </div>
                                  <span className="text-[14px] text-[#202124]">{item.answer || <span className="italic text-[#80868b]">Sin responder</span>}</span>
                                </div>
                                {isIncorrect && <X className="text-[#d93025] shrink-0" size={20} />}
                                {isCorrect && <CheckCircle2 className="text-[#1e8e3e] shrink-0" size={20} />}
                              </div>
                            )}

                            {/* Respuesta Correcta (si se equivocó) */}
                            {isIncorrect && item.correctAnswer && (
                              <div className="mt-4">
                                <div className="text-[13px] text-[#5f6368] font-medium mb-2">Respuesta correcta</div>
                                <div className="px-4 py-2 flex items-center gap-3">
                                  <div className="w-5 h-5 rounded-full border-2 border-[#5f6368] flex items-center justify-center shrink-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#5f6368]"></div>
                                  </div>
                                  <span className="text-[14px] text-[#202124]">{item.correctAnswer}</span>
                                </div>
                              </div>
                            )}
                            
                            {!item.options && (
                              <div className="mt-4 text-[12px] text-[#bdc1c6] italic">
                                * Solo se muestran la respuesta elegida y la correcta.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-[8px] p-6 border border-[#dadce0] text-[14px] text-[#202124]">
                    {isGoogleForm ? (
                      <p>
                        Tu examen fue enviado con éxito a través de Google Forms y tus respuestas han sido registradas. 
                        Esta calificación ya es oficial en la plataforma. 
                        <br/><br/>
                        <span className="italic text-[13px] text-[#5f6368]">(El detalle individual de respuestas no está disponible para entregas antiguas).</span>
                      </p>
                    ) : submission.fileUrl ? (
                      <div className="flex flex-col gap-2 items-start">
                        <p>Has adjuntado un archivo con tus respuestas.</p>
                        <a href={submission.fileUrl} target="_blank" className="text-[#1a73e8] hover:underline font-medium text-[14px]">
                          Abrir archivo original
                        </a>
                      </div>
                    ) : (
                      <p>No se encontró información detallada de esta entrega.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
    document.body
  ) : null;

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
      {modalContent}
    </>
  );
}
