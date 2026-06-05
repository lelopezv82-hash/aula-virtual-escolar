import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import GestionPeriodosClient from "./GestionPeriodosClient";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-educational-key-2026"
);

export default async function GestionPeriodosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);

  const periods = await prisma.period.findMany({
    orderBy: { name: "asc" },
  });

  const serializedPeriods = periods.map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active,
  }));

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header mb-6">
        <h1>Gestión Periodos</h1>
        <p className="text-muted">
          Crea, edita y activa/desactiva los periodos lectivos para todas tus asignaturas.
        </p>
      </div>

      <GestionPeriodosClient initialPeriods={serializedPeriods} />
    </div>
  );
}
