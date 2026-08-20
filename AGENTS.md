<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Contexto y Memoria del Proyecto (Aula Virtual Escolar)

- **Repositorio**: `lelopezv82-hash/aula-virtual-escolar`
- **Despliegue**: Render (`https://aula-co.onrender.com`)
- **Stack**: Next.js (App Router, Turbopack) + TypeScript + Prisma ORM (PostgreSQL en Supabase) + JWT Auth.

## Funcionalidades Recientes Implementadas:
1. **Asignación de Tareas y Exámenes a Estudiantes Específicos**:
   - Relación `assignedStudents` / `assignedTasks` entre `Task` y `User`.
   - Endpoints: `POST /api/docente/tareas`, `PATCH /api/docente/tareas/[id]`, `GET/PUT /api/docente/tareas/[id]/assigned-students`.
   - Modales interactivos y selectores en la vista del docente para asignar individualmente.
   - Acceso para estudiantes: pueden ver actividades asignadas a su grupo O asignadas individualmente a ellos.

2. **Tablero Virtual para Estudiantes** (`/estudiante/tablero`):
   - KPIs de urgencia (<48h), tareas pendientes, exámenes próximos y completadas.
   - Vista de Línea de Tiempo Cronológica (Timeline: Hoy, Esta semana, Próximas semanas).
   - Vista de Calendario Mensual interactivo con visor de actividades por día.
   - Filtros en vivo por materia, tipo de actividad, periodo y texto.
   - Acceso directo en el menú lateral del estudiante con ícono `LayoutDashboard`.

