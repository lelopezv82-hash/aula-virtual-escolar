"use client";

import { useState } from "react";
import { Code, X, Copy, Check } from "lucide-react";

export default function GoogleFormsScriptModal({ taskId }: { taskId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const scriptContent = `// ====== CONFIGURACIÓN ======
const TASK_ID = "${taskId}";
const WEBHOOK_URL = "https://aula-virtual-co.onrender.com/api/webhooks/google-forms/" + TASK_ID;
// ===========================

function onFormSubmit(e) {
  try {
    const response = e.response;
    const form = FormApp.getActiveForm();
    const isQuiz = form.isQuiz();
    
    let studentName = "Desconocido";
    const itemResponses = response.getItemResponses();
    const rawData = [];

    for (let i = 0; i < itemResponses.length; i++) {
      const itemResponse = itemResponses[i];
      const item = itemResponse.getItem();
      const questionTitle = item.getTitle();
      const answer = itemResponse.getResponse();
      
      if (questionTitle.toLowerCase().includes("nombre") || 
          questionTitle.toLowerCase().includes("estudiante") || 
          questionTitle.toLowerCase().includes("apellido")) {
        studentName = answer;
      }

      let answerText = answer;
      if (Array.isArray(answer)) {
        answerText = answer.join(", ");
      }
      
      rawData.push({
        question: questionTitle,
        answer: answerText ? answerText.toString() : ""
      });
    }
    
    const respondentEmail = response.getRespondentEmail();
    if (studentName === "Desconocido" && respondentEmail) {
      studentName = respondentEmail.split('@')[0];
    }

    let score = null;
    if (isQuiz) {
      let totalScore = 0;
      let totalPossible = 0;
      
      const gradedResponses = response.getGradableItemResponses();
      for (let j = 0; j < gradedResponses.length; j++) {
        totalScore += gradedResponses[j].getScore() || 0;
        const gradableItem = gradedResponses[j].getItem();
        
        let maxScore = 0;
        switch(gradableItem.getType()) {
          case FormApp.ItemType.MULTIPLE_CHOICE:
            maxScore = gradableItem.asMultipleChoiceItem().getPoints() || 0;
            break;
          case FormApp.ItemType.CHECKBOX:
            maxScore = gradableItem.asCheckboxItem().getPoints() || 0;
            break;
          case FormApp.ItemType.LIST:
            maxScore = gradableItem.asListItem().getPoints() || 0;
            break;
          case FormApp.ItemType.TEXT:
            maxScore = gradableItem.asTextItem().getPoints() || 0;
            break;
          case FormApp.ItemType.PARAGRAPH_TEXT:
            maxScore = gradableItem.asParagraphTextItem().getPoints() || 0;
            break;
        }
        totalPossible += maxScore;
      }
      
      if (totalPossible > 0) {
        score = (totalScore / totalPossible) * 10;
      } else {
        score = totalScore;
      }
    }

    const payload = {
      studentName: studentName,
      score: score,
      rawData: rawData
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    console.log("Respuesta del servidor:", res.getContentText());

  } catch (err) {
    console.error("Error en el Webhook:", err);
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary flex items-center gap-2"
        title="Ver código de Google Forms"
      >
        <Code size={16} />
        <span className="hidden sm:inline">Script Google Forms</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-t-xl shrink-0">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Code size={20} className="text-purple-500" />
                Script para Google Forms
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grow">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Copia y pega este código en el <strong>Editor de secuencia de comandos (Apps Script)</strong> de tu formulario de Google. Este código ya contiene el ID de esta tarea. Asegúrate de configurar un disparador "Al enviar el formulario".
                </p>
              </div>

              <div className="relative">
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs"
                >
                  {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar Código</>}
                </button>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" style={{ maxHeight: '50vh' }}>
                  <code>{scriptContent}</code>
                </pre>
              </div>
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
