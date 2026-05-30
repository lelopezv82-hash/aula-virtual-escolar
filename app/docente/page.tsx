import { redirect } from "next/navigation";

export default async function DocenteDashboard() {
  redirect("/docente/cursos");
}
