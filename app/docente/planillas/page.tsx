import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import PlanillasClient from "./PlanillasClient";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function PlanillasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) redirect("/login");

  let payload: any;
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    payload = verified.payload;
  } catch {
    redirect("/login");
  }

  // Get active periods
  const periods = await prisma.period.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" }
  });

  // Get teacher's courses with their associated grade groups
  const courses = await prisma.course.findMany({
    where: { teacherId: payload.id },
    include: {
      groups: {
        include: {
          grade: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const teacherName = payload.name;

  return (
    <PlanillasClient 
      courses={courses} 
      periods={periods} 
      teacherName={teacherName} 
    />
  );
}
