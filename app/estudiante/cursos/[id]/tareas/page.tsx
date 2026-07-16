import { redirect } from "next/navigation";

export default async function CursoTareasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/estudiante/cursos/${id}`);
}
