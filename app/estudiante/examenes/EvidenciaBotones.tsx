"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Eye, X, CheckCircle2, Loader2 } from "lucide-react";

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
    feedbackTemplate?: string | null;
    studentName?: string | null;
    attempt?: number;
    unlockedAnswers?: boolean;
    answers?: any;
  };
  isGoogleForm: boolean;
  onUnlock?: () => void;
}

export default function EvidenciaBotones({ exam, submission, isGoogleForm }: EvidenciaModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingUnlock, setLoadingUnlock] = useState(false);

  // If the student never submitted anything (automatically graded due to deadline)
  if (submission.submittedAt === null) {
    return null;
  }
  const [localFeedback, setLocalFeedback] = useState<string | null>(submission.feedback || null);
  const [localTemplate, setLocalTemplate] = useState<string | null>(submission.feedbackTemplate || null);
  const [nativeTask, setNativeTask] = useState<any>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  // Guard: prevent re-fetching when API returns null (would cause infinite spinner)
  const fetchedRef = useRef(false);

  useEffect(() => {
    setLocalFeedback(submission.feedback || null);
    setLocalTemplate(submission.feedbackTemplate || null);
  }, [submission.feedback, submission.feedbackTemplate]);

  useEffect(() => {
    const needsNative = !isGoogleForm && !nativeTask;
    const needsTemplate = isGoogleForm && !localFeedback && !localTemplate;

    if (isOpen && (needsNative || needsTemplate) && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoadingTask(true);
      fetch(`/api/estudiante/tareas/${exam.id}?_=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.feedbackTemplate) {
            setLocalTemplate(data.feedbackTemplate);
          }
          if (data.task) {
            setNativeTask(data.task);
          }
        })
        .catch(err => console.error("Error loading task in EvidenciaBotones:", err))
        .finally(() => setLoadingTask(false));
    }
  }, [isOpen, isGoogleForm, exam.id, nativeTask, localFeedback, localTemplate]);

  // Intentamos parsear las respuestas guardadas en feedback o feedbackTemplate (JSON string)
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
  
  const hasOwnFeedback = !!localFeedback;

  if (isGoogleForm && (localFeedback || localTemplate)) {
    try {
      const rawFeedback = localFeedback || localTemplate;
      const parsed = JSON.parse(rawFeedback!);
      if (Array.isArray(parsed)) {
        answersData = parsed.map(item => {
          if (!hasOwnFeedback) {
            const isNameQuestion = item.question.toLowerCase().includes("nombre") && 
              !item.question.toLowerCase().includes("docente") && 
              !item.question.toLowerCase().includes("profesor");
            
            return {
              ...item,
              answer: isNameQuestion ? (submission.studentName || "Estudiante") : "",
              score: isNameQuestion ? (item.maxScore || 0) : 0,
              isCorrect: isNameQuestion ? true : false
            };
          }
          return item;
        });
      }
    } catch (e) {}
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const studentAnswers = submission.answers || {};

  let feedbackDetails: any[] = [];
  if (submission && submission.feedback) {
    try {
      feedbackDetails = JSON.parse(submission.feedback);
    } catch {}
  }

  const modalContent = isOpen && mounted ? createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
      <button 
        onClick={() => setIsOpen(false)}
        className="fixed top-2 right-2 md:top-6 md:right-6 z-[110] bg-white/20 hover:bg-white text-white hover:text-gray-800 rounded-full p-2 transition-all shadow-lg backdrop-blur-md"
        title="Cerrar"
      >
        <X size={28} />
      </button>

      <div className="min-h-screen flex justify-center items-start bg-[#e8f0fe]">
        <div className="w-full max-w-[770px] flex flex-col animate-fade-in relative mx-auto p-4 md:p-6 lg:py-8">
                
                <div className="bg-white border border-[#dadce0] rounded-[8px] overflow-hidden mb-3 border-t-8 border-t-[#1a73e8]" style={{ marginBottom: '12px' }}>
                  <div className="p-6" style={{ padding: '24px' }}>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                      <h1 className="text-[24px] sm:text-[32px] text-[#202124] font-normal leading-tight break-words">{exam.title}</h1>
                      
                      <div className="flex flex-col items-end shrink-0 gap-1 mt-2">
                        <span className="text-sm text-[#202124]">Calificación</span>
                        <div className="bg-[#1a73e8] text-white px-3 py-1 rounded-[4px] font-medium text-sm">
                          {submission.grade !== null && submission.grade !== undefined ? Math.max(1.0, Number(submission.grade)).toFixed(1) : '?'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preguntas */}
                {loadingTask ? (
                  <div className="bg-white rounded-[8px] p-12 border border-[#dadce0] flex justify-center items-center">
                    <Loader2 className="animate-spin text-[#1a73e8]" size={36} />
                  </div>
                ) : isGoogleForm ? (
                  answersData && answersData.length > 0 ? (
                    <div className="flex flex-col gap-3" style={{ gap: '12px' }}>
                      {answersData.map((item, index) => {
                        if (item.isGradable === false) {
                          return (
                            <div key={index} className="bg-white p-6 rounded-[8px] border border-[#dadce0] shadow-sm" style={{ padding: '24px' }}>
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
                          <div key={index} className="bg-white p-6 rounded-[8px] border border-[#dadce0] shadow-sm" style={{ padding: '24px' }}>
                            <div className="flex justify-between items-start gap-4 mb-4">
                              <p className="text-base text-[#202124] font-medium leading-normal">
                                {item.question}
                              </p>
                              <span className="text-xs text-[#5f6368] shrink-0 font-medium whitespace-nowrap">
                                {item.score !== null && item.score !== undefined ? item.score : 0} / {item.maxScore !== null && item.maxScore !== undefined ? item.maxScore : 0} puntos
                              </span>
                            </div>

                            {item.options && item.options.length > 0 ? (
                              <div className="flex flex-col gap-3 mt-4">
                                {item.options.map((option, oIndex) => {
                                  const isSelected = item.answer === option;
                                  const isOptCorrect = item.correctAnswer === option;

                                  let optBg = "bg-white";
                                  let optBorder = "border-[#dadce0]";
                                  let optText = "text-[#202124]";

                                  if (isOptCorrect) {
                                    optBg = "bg-[#e6f4ea]";
                                    optBorder = "border-[#137333]";
                                    optText = "text-[#137333] font-semibold";
                                  } else if (isSelected && isIncorrect) {
                                    optBg = "bg-[#fce8e6]";
                                    optBorder = "border-[#c5221f]";
                                    optText = "text-[#c5221f] font-semibold";
                                  }

                                  return (
                                    <div key={oIndex} className={`flex items-center gap-3 p-3 rounded-[4px] border ${optBorder} ${optBg}`}>
                                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? (isCorrect ? "bg-[#137333] border-[#137333]" : "bg-[#c5221f] border-[#c5221f]") : "border-[#dadce0]"}`}>
                                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                      </div>
                                      <span className={`text-[14px] ${optText}`}>{option}</span>
                                      {isOptCorrect && <CheckCircle2 size={16} className="text-[#137333] ml-auto shrink-0" />}
                                      {isSelected && isIncorrect && <X size={16} className="text-[#c5221f] ml-auto shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-4 p-3 bg-gray-50 border border-[#dadce0] rounded-[4px]">
                                <p className="text-[12px] text-[#5f6368] font-bold">Respuesta del estudiante:</p>
                                <p className={`text-[14px] mt-1 font-semibold ${isCorrect ? "text-[#137333]" : "text-[#c5221f]"}`}>{item.answer || "(Vacío)"}</p>
                              </div>
                            )}
                            
                            {isIncorrect && item.correctAnswer && (
                              <div className="p-3 rounded-r-[4px] rounded-l-none bg-[#f8f9fa] border-l-4 border-l-[#137333] text-xs mt-2 flex flex-col gap-1">
                                <span className="font-bold text-[#137333]">Respuesta correcta:</span>
                                <span className="font-semibold text-sm" style={{ color: "#202124" }}>{item.correctAnswer}</span>
                              </div>
                            )}

                            {!item.options && (
                              <div className="mt-4 text-[12px] text-[#bdc1c6] italic">
                                * Solo se muestran la respuesta elegida y la correcta.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-[8px] p-6 border border-[#dadce0] text-[14px] text-[#202124]" style={{ padding: '24px' }}>
                       {!submission.feedback && (submission.grade === null || submission.grade === undefined || Math.max(1.0, submission.grade) === 1.0) ? (
                        <p className="text-[#d93025] font-medium text-base">
                          Este examen fue calificado con la nota mínima de <strong>1.0</strong> debido a que el plazo venció o el tiempo expiró sin que se registraran respuestas en la plataforma.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <p>No se encontró información detallada de esta entrega en la plataforma.</p>
                          {nativeTask?.attachmentUrl && (
                            <div className="mt-2">
                              <p className="mb-2 text-sm text-[#5f6368]">Puedes acceder al formulario del examen utilizando el siguiente enlace:</p>
                              <a 
                                href={nativeTask.attachmentUrl} 
                                target="_blank" 
                                className="inline-flex items-center justify-center px-4 py-2 text-white rounded-[4px] font-medium text-[14px] hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: 'var(--primary-color)' }}
                              >
                                Abrir Formulario de Google Forms
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  nativeTask && nativeTask.questions && nativeTask.questions.length > 0 ? (
                    <div className="flex flex-col gap-3" style={{ gap: '12px' }}>
                      {nativeTask.questions.map((q: any, index: number) => {
                        const studentAns = studentAnswers[q.id];
                        const detail = feedbackDetails.find((d: any) => d.questionId === q.id) || {};
                        const isCorrect = detail.isCorrect ?? (q.type === "MULTIPLE_CHOICE"
                          ? q.options.find((o: any) => o.isCorrect)?.id === studentAns
                          : q.options[0]?.text?.trim().toLowerCase() === studentAns?.trim().toLowerCase());

                        return (
                          <div key={q.id} className={`bg-white p-6 rounded-[8px] border border-[#dadce0] shadow-sm flex flex-col gap-3 ${
                            isCorrect 
                              ? "border-l-8 border-l-[#137333]" 
                              : "border-l-8 border-l-[#c5221f]"
                          }`} style={{ padding: '24px' }}>
                            <div className="flex justify-between items-start gap-4">
                              <p className="text-base text-[#202124] font-medium leading-normal">
                                {index + 1}. {q.text}
                              </p>
                              <span className="text-xs text-[#5f6368] shrink-0 font-medium whitespace-nowrap">
                                {isCorrect ? q.points : 0} / {q.points} puntos
                              </span>
                            </div>

                            {q.type === "MULTIPLE_CHOICE" ? (
                              <div className="flex flex-col gap-3 mt-4">
                                {q.options.map((opt: any) => {
                                  const isSelected = studentAns === opt.id;
                                  const isOptCorrect = opt.isCorrect;

                                  let optBg = "bg-white";
                                  let optBorder = "border-[#dadce0]";
                                  let optText = "text-[#202124]";

                                  if (isSelected && isOptCorrect) {
                                    optBg = "bg-[#e6f4ea]";
                                    optBorder = "border-[#137333]";
                                    optText = "text-[#137333] font-semibold";
                                  } else if (isSelected && !isOptCorrect) {
                                    optBg = "bg-[#fce8e6]";
                                    optBorder = "border-[#c5221f]";
                                    optText = "text-[#c5221f] font-semibold";
                                  }

                                  return (
                                    <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-[4px] border ${optBorder} ${optBg}`}>
                                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                        isSelected && !isOptCorrect 
                                          ? "bg-[#c5221f] border-[#c5221f]" 
                                          : isSelected && isOptCorrect 
                                            ? "bg-[#137333] border-[#137333]" 
                                            : "border-[#dadce0]"
                                      }`}>
                                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                      </div>
                                      <span className={`text-[14px] ${optText}`}>{opt.text}</span>
                                      {isSelected && isOptCorrect && <CheckCircle2 size={16} className="text-[#137333] ml-auto shrink-0" />}
                                      {isSelected && !isOptCorrect && <X size={16} className="text-[#c5221f] ml-auto shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs flex flex-col gap-2 mt-2">
                                <div className={`p-2.5 rounded border ${isCorrect ? "border-[#137333] bg-[#e6f4ea]/30" : "border-[#c5221f] bg-[#fce8e6]/30"}`}>
                                  <p className="text-[#5f6368] font-semibold mb-0.5">Tu respuesta:</p>
                                  <p className={`text-[14px] font-bold ${isCorrect ? "text-[#137333]" : "text-[#c5221f]"}`}>
                                    {studentAns || "(Vacío)"}
                                  </p>
                                </div>
                              </div>
                            )}

                            {!isCorrect && (
                               <div className="p-3 rounded-r-[4px] rounded-l-none bg-[#f8f9fa] border-l-4 border-l-[#137333] text-xs mt-2 flex flex-col gap-1">
                                 <span className="font-bold text-[#137333]">Respuesta correcta:</span>
                                 <span className="font-semibold text-sm" style={{ color: "#202124" }}>
                                   {q.type === "MULTIPLE_CHOICE" 
                                     ? detail.correctOptionText || q.options.find((o: any) => o.id === detail.correctOptionId)?.text || q.options.find((o: any) => o.isCorrect)?.text || "(Sin especificar)"
                                     : detail.correctText || q.options[0]?.text || "(Sin especificar)"}
                                 </span>
                               </div>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-[8px] p-6 border border-[#dadce0] text-[14px] text-[#202124]" style={{ padding: '24px' }}>
                      {submission.fileUrl ? (
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
                  )
                )}
              </div>
            </div>
          </div>,
    document.body
  ) : null;

  const handleVerRespuestas = () => {
    setIsOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-2 w-full items-start">
        <button 
          onClick={handleVerRespuestas}
          className="btn flex items-center justify-center gap-2 w-full md:w-auto hover:opacity-90 transition-opacity" 
          style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
        >
          <Eye size={16} />
          Ver Respuestas
        </button>
      </div>
      {modalContent}
    </>
  );
}
