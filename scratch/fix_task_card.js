const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const lines = content.split('\n');

// Lines 3940-3948 (0-indexed: 3939-3947) are broken, replace them
const before = lines.slice(0, 3939); // up to and including line 3939 (</button> close of visible toggle)
const after = lines.slice(3948);     // from line 3949 onwards (</div></div>); )

const newSection = `                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openGradingModal(t)} className="p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-[#f98012] transition-colors" title="Calificar estudiantes">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => openDuplicateModal(t)} className="p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-purple-600 transition-colors" title="Clonar / Duplicar a otro curso o grupo (con notas limpias)">
                          <Copy size={13} />
                        </button>
                        <button onClick={() => openEditModal(t)} disabled={loadingEdit} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title={t.type === "EXAM" ? "Editar examen" : t.type === "TASK" ? "Editar tarea" : "Editar evaluación"}>
                          {loadingEdit ? <Loader2 size={13} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                        </button>
                        <button onClick={() => handleDeleteTask(t.id, t.title)} disabled={deletingId === t.id} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title={t.type === "EXAM" ? "Eliminar examen" : t.type === "TASK" ? "Eliminar tarea" : "Eliminar evaluación"}>
                          {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    {/* Gestionar examen (solo para exámenes/finales) */}
                    {!t.isExternal && (t.type === "EXAM" || t.type === "FINAL") && (
                      <button
                        onClick={() => openQuestionsModal(t)}
                        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors w-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                        title="Gestionar preguntas, entregas e intentos"
                      >
                        Gestionar Examen
                      </button>
                    )}
                  </div>
                </div>`;

const finalContent = before.join('\n') + '\n' + newSection + '\n' + after.join('\n');
fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', finalContent, 'utf8');
console.log('Done - task card buttons restored and Gestionar Entregas removed');
