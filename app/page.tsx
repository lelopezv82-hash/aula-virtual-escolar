import Link from "next/link";
import Image from "next/image";
import "./page.css";

export default function Home() {
  return (
    <div className="landing-container flex flex-col items-center justify-center">
      <div className="glass-panel landing-card animate-fade-in">
        <div className="logo-container">
          <div className="logo-image-wrapper">
            <Image 
              src="/classroom_logo.png" 
              alt="Aula Virtual Logo" 
              width={180} 
              height={180} 
              className="logo-image"
              priority
            />
          </div>
          <h1 className="logo-text">Aula Virtual</h1>
          <p className="subtitle">
            Tu portal digital hacia el aprendizaje y la excelencia académica
          </p>
        </div>
        
        <div className="actions-container flex flex-col gap-4 mt-6">
          <Link href="/login" className="btn btn-primary w-full btn-lg">
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
