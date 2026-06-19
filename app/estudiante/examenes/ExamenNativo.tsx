"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, AlertTriangle, Save, Loader2, Check, X, Clock } from "lucide-react";

interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  id: string;
  text: string;
  type: string;
  points: number;
  order: number;
  options: Option[];
}

interface Submission {
  id: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  answers: any;
  startedAt: string | null;
}

interface ExamenNativoProps {
  taskId: string;
  questions: Question[];
  submission: Submission | null;
  onSubmissionUpdated: (sub: any) => void;
  timeLeft: number | null;
  isTimerExpired: boolean;
  triggerAutoSubmit: () => void;
}

export default function ExamenNativo({
  taskId,
  questions,
  submission,
  onSubmissionUpdated,
  timeLeft,
  isTimerExpired,
  triggerAutoSubmit
}: ExamenNativoProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize answers from submission if it exists
  useEffect(() => {
    if (submission && typeof submission.answers === "object" && submission.answers !== null) {
      setAnswers(submission.answers);
    }
  }, [submission]);

  // Autosave function
  const saveAnswers = async (latestAnswers: Record<string, string>) => {
    setSavingStatus("saving");
    try {
      const res = await fetch(`/api/estudiante/tareas/${taskId}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: latestAnswers })
      });
      if (res.ok) {
        setSavingStatus("saved");
        setTimeout(() => setSavingStatus("idle"), 2000);
      } else {
        setSavingStatus("error");
      }
    } catch {
      setSavingStatus("error");
    }
  };

  const handleAnswerChange = (questionId: string, answerVal: string) => {
    const updatedAnswers = {
      ...answers,
      [questionId]: answerVal
    };
    setAnswers(updatedAnswers);

    // Debounce the save to prevent API spamming
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswers(updatedAnswers);
    }, 800);
  };

  const handleSubmitExam = async () => {
    if (!confirm("¿Estás seguro de que deseas enviar el examen? Una vez enviado, no podrás modificar tus respuestas.")) {
      return;
    }
    await executeFinalSubmit();
  };

  const executeFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/estudiante/tareas/${taskId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (res.ok) {
        onSubmissionUpdated(data.submission);
      } else {
        alert(data.error || "Error al enviar el examen");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al enviar el examen");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger submission automatically when timer expires
  useEffect(() => {
    if (isTimerExpired && submission?.status !== "GRADED" && !isSubmitting) {
      executeFinalSubmit();
    }
  }, [isTimerExpired]);

  const isGraded = submission?.status === "GRADED";

  // Parse feedback for details if graded
  let feedbackDetails: any[] = [];
  if (isGraded && submission?.feedback) {
    try {
      feedbackDetails = JSON.parse(submission.feedback);
    } catch {
      // Not JSON or legacy string feedback
    }
  }

  if (isGraded) {
    return (
      <div className="flex flex-col gap-6">
        {/* Results Overview Card */}
        <div className="card p-6 border-l-4 border-l-green-500 bg-green-50/20 dark:bg-green-950/5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle size={24} /> Examen Calificado Nativamente
              </h3>
              <p className="text-muted text-sm mt-1">
                Tus respuestas han sido procesadas. Revisa la corrección detallada a continuación.
              </p>
            </div>
            <div className="p-4 rounded-full bg-white dark:bg-gray-800 shadow-sm border-2 border-green-500 flex flex-col items-center justify-center w-28 h-28 shrink-0">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Nota</span>
              <span className="text-2xl font-black text-green-600 dark:text-green-400">{submission.grade}</span>
              <span className="text-[10px] text-gray-400">/ 5.0</span>
            </div>
          </div>
        </div>

        {/* Detailed Correction list */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-lg">Revisión de Preguntas</h3>
          {questions.map((q, idx) => {
            const detail = feedbackDetails.find(d => d.questionId === q.id) || {};
            const isCorrect = detail.isCorrect;
            const studentAns = answers[q.id];

            return (
              <div 
                key={q.id} 
                className={`p-5 rounded-xl border flex flex-col gap-3 ${
                  isCorrect 
                    ? "bg-green-50/20 border-green-200 dark:bg-green-950/5 dark:border-green-900/40" 
                    : "bg-red-50/20 border-red-200 dark:bg-red-950/5 dark:border-red-900/40"
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <h4 className="font-bold text-sm text-primary">
                    {idx + 1}. {q.text}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded font-black shrink-0 ${
                    isCorrect 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  }`}>
                    {isCorrect ? q.points : 0} / {q.points} pts
                  </span>
                </div>

                {q.type === "MULTIPLE_CHOICE" ? (
                  <div className="flex flex-col gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isSelected = studentAns === opt.id;
                      const isOptCorrect = opt.isCorrect;

                      let optStyle = "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900";
                      let icon = null;

                      if (isSelected && isOptCorrect) {
                        optStyle = "border-green-500 bg-green-50/30 dark:border-green-900/50 dark:bg-green-950/20 font-bold text-green-700 dark:text-green-600";
                        icon = <Check size={14} className="text-green-500" />;
                      } else if (isSelected && !isOptCorrect) {
                        optStyle = "border-red-500 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/20 font-bold text-red-700 dark:text-red-600";
                        icon = <X size={14} className="text-red-500" />;
                      }

                      return (
                        <div key={opt.id} className={`flex items-center gap-2 p-2.5 rounded border ${optStyle}`}>
                          <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected && !isOptCorrect 
                              ? "bg-red-500 border-red-500" 
                              : isSelected && isOptCorrect 
                                ? "bg-green-500 border-green-500" 
                                : "border-gray-300"
                          }`}>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="flex-1">{opt.text}</span>
                          {icon}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs flex flex-col gap-2">
                    <div className={`p-2.5 rounded border ${isCorrect ? "border-green-500 bg-green-50/10" : "border-red-500 bg-red-50/10"}`}>
                      <p className="text-muted font-semibold mb-0.5">Tu respuesta:</p>
                      <p className={isCorrect ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                        {studentAns || "(Vacío)"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Google Forms Style Correction Feedback Block */}
                {!isCorrect && (
                  <div className="p-3 rounded-r-lg rounded-l-none bg-gray-100 dark:bg-gray-800 border-l-4 border-l-green-500 text-xs mt-2 flex flex-col gap-1">
                    <span className="font-bold text-green-600 dark:text-green-400">Respuesta correcta:</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {q.type === "MULTIPLE_CHOICE" 
                        ? q.options.find(o => o.isCorrect)?.text 
                        : q.options[0]?.text || "(Sin especificar)"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active exam view (student is answering)
  return (
    <div className="flex flex-col gap-6">
      {/* Saving and sync indicator */}
      <div className="flex justify-between items-center py-2 px-4 rounded bg-gray-100/60 dark:bg-gray-800/50 text-xs">
        <span className="text-muted flex items-center gap-1.5">
          {savingStatus === "saving" && (
            <>
              <Loader2 className="animate-spin text-blue-500" size={14} />
              <span>Guardando respuestas automáticamente...</span>
            </>
          )}
          {savingStatus === "saved" && (
            <>
              <Check className="text-green-500" size={14} />
              <span className="text-green-600 font-medium">Respuestas guardadas</span>
            </>
          )}
          {savingStatus === "error" && (
            <>
              <AlertTriangle className="text-red-500" size={14} />
              <span className="text-red-600 font-bold">Error al guardar. Revisa tu internet</span>
            </>
          )}
          {savingStatus === "idle" && (
            <>
              <Save size={14} />
              <span>Tus respuestas se guardan en tiempo real.</span>
            </>
          )}
        </span>
        <span className="font-medium">Total: {questions.reduce((sum, q) => sum + q.points, 0)} puntos</span>
      </div>

      {/* Exam questions list */}
      <div className="flex flex-col gap-4">
        {questions.map((q, idx) => {
          const studentAns = answers[q.id] || "";

          return (
            <div key={q.id} className="card p-5 border flex flex-col gap-3" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between items-start gap-4">
                <h4 className="font-bold text-sm text-primary">
                  {idx + 1}. {q.text}
                </h4>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted shrink-0">
                  {q.points} pt{q.points !== 1 ? "s" : ""}
                </span>
              </div>

              {q.type === "MULTIPLE_CHOICE" ? (
                <div className="flex flex-col gap-2.5 text-xs">
                  {q.options.map((opt) => {
                    const isSelected = studentAns === opt.id;
                    return (
                      <label 
                        key={opt.id} 
                        onClick={() => handleAnswerChange(q.id, opt.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? "bg-blue-50/50 border-blue-400 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900" 
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={isSelected}
                          readOnly
                          className="h-4 w-4 text-blue-600 cursor-pointer"
                        />
                        <span>{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs">
                  <input
                    type="text"
                    value={studentAns}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="Escribe tu respuesta aquí..."
                    className="w-full p-3 rounded-lg border focus:outline-none"
                    style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
        <button
          onClick={handleSubmitExam}
          disabled={isSubmitting}
          className="btn btn-primary flex items-center gap-2 py-3 px-8 text-sm font-bold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Enviando examen...
            </>
          ) : (
            <>
              <CheckCircle size={16} /> Entregar Examen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
