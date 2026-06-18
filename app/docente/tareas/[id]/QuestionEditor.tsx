"use client";

import { useState } from "react";
import { Plus, Trash2, Check, Save, Loader2, ArrowUp, ArrowDown, Edit3, X } from "lucide-react";

interface Option {
  id?: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  type: string;
  points: number;
  order: number;
  options: Option[];
}

interface QuestionEditorProps {
  taskId: string;
  initialQuestions: Question[];
}

export default function QuestionEditor({ taskId, initialQuestions }: QuestionEditorProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // holds questionId being saved/deleted or 'global'
  const [error, setError] = useState<string | null>(null);

  // Form state for creating/editing a question
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState("MULTIPLE_CHOICE");
  const [formPoints, setFormPoints] = useState(1.0);
  const [formOptions, setFormOptions] = useState<Option[]>([
    { text: "Opción A", isCorrect: true },
    { text: "Opción B", isCorrect: false },
  ]);

  const handleStartCreate = () => {
    setEditingId("new");
    setFormText("");
    setFormType("MULTIPLE_CHOICE");
    setFormPoints(1.0);
    setFormOptions([
      { text: "Opción A", isCorrect: true },
      { text: "Opción B", isCorrect: false },
    ]);
    setError(null);
  };

  const handleStartEdit = (q: Question) => {
    setEditingId(q.id);
    setFormText(q.text);
    setFormType(q.type);
    setFormPoints(q.points);
    setFormOptions(q.options.map(opt => ({ ...opt })));
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setError(null);
  };

  const handleAddOption = () => {
    setFormOptions([...formOptions, { text: `Opción ${String.fromCharCode(65 + formOptions.length)}`, isCorrect: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (formOptions.length <= 1) return;
    const newOptions = [...formOptions];
    newOptions.splice(index, 1);
    
    // Ensure at least one is correct if type is multiple choice
    if (formType === "MULTIPLE_CHOICE" && !newOptions.some(o => o.isCorrect)) {
      newOptions[0].isCorrect = true;
    }
    setFormOptions(newOptions);
  };

  const handleOptionTextChange = (index: number, val: string) => {
    const newOptions = [...formOptions];
    newOptions[index].text = val;
    setFormOptions(newOptions);
  };

  const handleOptionCorrectChange = (index: number) => {
    const newOptions = formOptions.map((o, idx) => ({
      ...o,
      isCorrect: idx === index
    }));
    setFormOptions(newOptions);
  };

  const handleSave = async () => {
    if (!formText.trim()) {
      setError("El texto de la pregunta es obligatorio.");
      return;
    }

    if (formType === "MULTIPLE_CHOICE") {
      if (formOptions.length < 2) {
        setError("Las preguntas de opción múltiple deben tener al menos 2 opciones.");
        return;
      }
      if (!formOptions.some(o => o.isCorrect)) {
        setError("Debe marcar una opción como correcta.");
        return;
      }
      if (formOptions.some(o => !o.text.trim())) {
        setError("El texto de todas las opciones es obligatorio.");
        return;
      }
    }

    setLoading(editingId);
    setError(null);

    try {
      const isNew = editingId === "new";
      const url = isNew 
        ? `/api/docente/tareas/${taskId}/questions` 
        : `/api/docente/tareas/${taskId}/questions/${editingId}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: formText,
          type: formType,
          points: formPoints,
          order: isNew ? questions.length : questions.find(q => q.id === editingId)?.order || 0,
          options: formType === "MULTIPLE_CHOICE" ? formOptions : []
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar la pregunta");
      }

      if (isNew) {
        setQuestions([...questions, data.question]);
      } else {
        setQuestions(questions.map(q => q.id === editingId ? data.question : q));
      }
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (qId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta pregunta?")) return;
    setLoading(qId);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}/questions/${qId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar");
      }
      setQuestions(questions.filter(q => q.id !== qId));
    } catch (err: any) {
      alert(err.message || "Error de conexión");
    } finally {
      setLoading(null);
    }
  };

  const moveQuestion = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    setLoading("global");
    const newQuestions = [...questions];
    
    // Swap order
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;

    // Recalculate orders
    const updatedWithOrder = newQuestions.map((q, idx) => ({ ...q, order: idx }));
    setQuestions(updatedWithOrder);

    // Save orders to DB asynchronously
    try {
      await Promise.all(
        updatedWithOrder.map(q => 
          fetch(`/api/docente/tareas/${taskId}/questions/${q.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: q.text,
              type: q.type,
              points: q.points,
              order: q.order,
              options: q.options
            })
          })
        )
      );
    } catch {
      console.error("Error updating question orders in DB");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card w-full mb-6">
      <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Examen Nativo de la Plataforma
          </h2>
          <p className="text-muted text-xs font-medium">
            Agrega preguntas y opciones. Si hay preguntas creadas, los estudiantes tomarán el examen nativamente en lugar del formulario de Google.
          </p>
        </div>
        {editingId !== "new" && (
          <button 
            onClick={handleStartCreate}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={16} /> Agregar Pregunta
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger mb-4 py-2 px-3 text-sm">{error}</div>}

      {/* Editor Panel */}
      {editingId && (
        <div className="p-4 mb-6 rounded-lg border bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-primary">
              {editingId === "new" ? "Nueva Pregunta" : "Editar Pregunta"}
            </h3>
            <button onClick={handleCancel} className="text-muted hover:text-red-500">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted">Texto de la Pregunta</label>
            <input
              type="text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Ej. ¿Cuál es la capital de Colombia?"
              className="w-full text-sm p-2 rounded border focus:outline-none"
              style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted">Tipo de Pregunta</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="text-sm p-2 rounded border focus:outline-none"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
              >
                <option value="MULTIPLE_CHOICE">Opción Múltiple</option>
                <option value="TEXT">Respuesta de Texto Corto</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted">Puntos</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formPoints}
                onChange={(e) => setFormPoints(parseFloat(e.target.value) || 0)}
                className="text-sm p-2 rounded border focus:outline-none"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
              />
            </div>
          </div>

          {/* Options / Answers Section */}
          {formType === "MULTIPLE_CHOICE" ? (
            <div className="flex flex-col gap-2.5 mt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted">Opciones (Selecciona la correcta)</label>
                <button 
                  type="button" 
                  onClick={handleAddOption}
                  className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-0.5"
                >
                  <Plus size={14} /> Añadir opción
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {formOptions.map((opt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={opt.isCorrect}
                      onChange={() => handleOptionCorrectChange(index)}
                      className="cursor-pointer h-4 w-4 text-blue-600"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(index, e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      className="flex-1 text-sm p-1.5 rounded border focus:outline-none"
                      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
                    />
                    {formOptions.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="text-muted hover:text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold text-muted">Respuesta Correcta Esperada (Opcional, coincide de forma exacta)</label>
              <input
                type="text"
                value={formOptions[0]?.text || ""}
                onChange={(e) => setFormOptions([{ text: e.target.value, isCorrect: true }])}
                placeholder="Ej. Bogotá (Dejar vacío si calificarás manualmente)"
                className="w-full text-sm p-2 rounded border focus:outline-none"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button 
              type="button" 
              onClick={handleCancel}
              className="btn btn-secondary btn-sm"
              disabled={loading === editingId}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              className="btn btn-primary btn-sm flex items-center gap-1"
              disabled={loading === editingId}
            >
              {loading === editingId ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Guardar Pregunta
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="text-center py-8 text-muted border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2" style={{ borderColor: "var(--border-color)" }}>
          <p className="text-sm font-medium">No hay preguntas creadas para este examen.</p>
          <button 
            onClick={handleStartCreate}
            className="btn btn-primary btn-sm mt-1"
          >
            Crear primera pregunta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q, index) => {
            const isEditing = editingId === q.id;
            return (
              <div 
                key={q.id} 
                className={`p-4 rounded-lg border bg-white dark:bg-gray-900 flex flex-col gap-2 transition-shadow hover:shadow-sm ${isEditing ? "opacity-50 pointer-events-none" : ""}`}
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                      <span>{index + 1}. {q.text}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                        {q.points} pt{q.points !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted">
                        ({q.type === "MULTIPLE_CHOICE" ? "Opción Múltiple" : "Respuesta de Texto"})
                      </span>
                    </h4>

                    {q.type === "MULTIPLE_CHOICE" && (
                      <ul className="list-disc pl-5 mt-2 flex flex-col gap-1 text-xs">
                        {q.options.map((opt, oIdx) => (
                          <li key={oIdx} className="flex items-center gap-1.5 text-muted">
                            <span className={`inline-block h-2 w-2 rounded-full ${opt.isCorrect ? "bg-green-500" : "bg-gray-300"}`} />
                            <span className={opt.isCorrect ? "font-bold text-green-600 dark:text-green-400" : ""}>{opt.text}</span>
                            {opt.isCorrect && <Check size={12} className="text-green-500" />}
                          </li>
                        ))}
                      </ul>
                    )}

                    {q.type === "TEXT" && q.options[0]?.text && (
                      <p className="text-xs text-muted mt-2">
                        Respuesta correcta esperada: <strong className="text-green-600 dark:text-green-400">{q.options[0].text}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 no-print">
                    <button
                      onClick={() => moveQuestion(index, "up")}
                      disabled={index === 0 || loading === "global"}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-muted disabled:opacity-30"
                      title="Subir"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => moveQuestion(index, "down")}
                      disabled={index === questions.length - 1 || loading === "global"}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-muted disabled:opacity-30"
                      title="Bajar"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-blue-500"
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={loading === q.id}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500"
                      title="Eliminar"
                    >
                      {loading === q.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
