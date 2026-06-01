import Link from "next/link";
import { BookOpen } from "lucide-react";
import "./page.css"; // We'll create this

export default function Home() {
  return (
    <div className="landing-container flex flex-col items-center justify-center">
      <div className="glass-panel landing-card animate-fade-in">
        <div className="logo-container">
          <div className="logo-icon">
            <BookOpen size={48} color="var(--primary-color)" />
          </div>
          <h1 className="logo-text">Aula Virtual</h1>
          <p className="subtitle">Excelencia educativa en tus manos</p>
        </div>
        
        <div className="actions-container flex flex-col gap-4 mt-4">
          <Link href="/login" className="btn btn-primary w-full">
            Iniciar Sesión
          </Link>
        </div>
      </div>
      
      <div className="background-decorations">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
    </div>
  );
}
