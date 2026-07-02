import Link from "next/link";
import { BookOpen, Shield, GraduationCap, CheckCircle2, ChevronRight, ArrowRight } from "lucide-react";
import "./page.css";

export default function Home() {
  return (
    <div className="landing-container">
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="navbar-content container">
          <Link href="/" className="nav-logo">
            <BookOpen size={28} className="logo-icon" />
            <span>Aula Virtual</span>
          </Link>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-secondary nav-btn">
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content container">
          <div className="hero-text-side">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Plataforma Educativa Oficial
            </div>
            <h1 className="hero-title">
              El Portal al Conocimiento y la <span className="highlight">Excelencia Académica</span>
            </h1>
            <p className="hero-subtitle">
              Una plataforma ágil y moderna que conecta a estudiantes, docentes y administradores en un entorno digital interactivo y de alto rendimiento. Gestiona tus tareas, recursos y calificaciones en un solo lugar.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn btn-primary btn-lg">
                Ingresar a la Plataforma <ArrowRight size={20} />
              </Link>
              <a href="#features" className="btn btn-secondary btn-lg">
                Conocer Más
              </a>
            </div>
          </div>

          <div className="hero-visual-side">
            {/* Interactive Mockup in Pure CSS/HTML */}
            <div className="mockup-window glass-panel">
              <div className="mockup-header">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
                <span className="mockup-title">aula-virtual.edu.co</span>
              </div>
              <div className="mockup-body">
                {/* Mockup Dashboard Header */}
                <div className="mockup-dashboard-header">
                  <div className="mockup-user-info">
                    <div className="mockup-avatar">JP</div>
                    <div>
                      <div className="mockup-user-name">Juan Pérez</div>
                      <div className="mockup-user-role">Estudiante • Grado 10-A</div>
                    </div>
                  </div>
                  <span className="badge badge-success">Activo</span>
                </div>

                {/* Mockup Stats */}
                <div className="mockup-stats-grid">
                  <div className="mockup-stat-card">
                    <div className="stat-label">Promedio General</div>
                    <div className="stat-value text-primary">4.6</div>
                    <div className="stat-progress"><span style={{ width: "92%" }}></span></div>
                  </div>
                  <div className="mockup-stat-card">
                    <div className="stat-label">Tareas Entregadas</div>
                    <div className="stat-value text-success">18 / 20</div>
                    <div className="stat-progress"><span style={{ width: "90%", backgroundColor: "var(--success)" }}></span></div>
                  </div>
                </div>

                {/* Mockup Task list */}
                <div className="mockup-section">
                  <div className="mockup-section-title">Tareas Pendientes</div>
                  <div className="mockup-task-item">
                    <div className="task-bullet"></div>
                    <div className="task-details">
                      <div className="task-title">Taller: Funciones Trigonométricas</div>
                      <div className="task-deadline">Vence: Mañana, 11:59 PM</div>
                    </div>
                    <span className="badge badge-warning">Pendiente</span>
                  </div>
                  <div className="mockup-task-item">
                    <div className="task-bullet success"></div>
                    <div className="task-details">
                      <div className="task-title">Ensayo: Literatura del Boom Latinoamericano</div>
                      <div className="task-deadline">Calificación: 4.8 / 5.0</div>
                    </div>
                    <span className="badge badge-success">Calificado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background blobs */}
        <div className="hero-bg-blobs">
          <div className="hero-blob blob-orange"></div>
          <div className="hero-blob blob-purple"></div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header text-center">
            <h2 className="section-title">Diseñado para cada miembro de la comunidad</h2>
            <p className="section-subtitle">
              Herramientas optimizadas para estudiantes, docentes y administradores escolares.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature Card 1 */}
            <div className="feature-card card">
              <div className="feature-icon-wrapper">
                <BookOpen size={28} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Estudiantes</h3>
              <p className="feature-card-desc">
                Accede a un portal interactivo para gestionar tu aprendizaje de manera autónoma y eficiente.
              </p>
              <ul className="feature-list">
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Tareas y entregas virtuales</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Calificaciones detalladas en tiempo real</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Exámenes interactivos y recursos</span>
                </li>
              </ul>
            </div>

            {/* Feature Card 2 */}
            <div className="feature-card card">
              <div className="feature-icon-wrapper">
                <GraduationCap size={28} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Docentes</h3>
              <p className="feature-card-desc">
                Simplifica tu carga de trabajo administrativo para enfocarte en lo que de verdad importa: enseñar.
              </p>
              <ul className="feature-list">
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Planillas de notas y cálculo automático</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Importación rápida desde archivos Excel</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Gestión de periodos y actividades</span>
                </li>
              </ul>
            </div>

            {/* Feature Card 3 */}
            <div className="feature-card card">
              <div className="feature-icon-wrapper">
                <Shield size={28} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Administradores</h3>
              <p className="feature-card-desc">
                Mantén el control total y la integridad de los datos de la institución escolar en un solo lugar.
              </p>
              <ul className="feature-list">
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Gestión centralizada de usuarios y roles</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Administración de cursos y matrículas</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="list-icon" />
                  <span>Control de periodos académicos</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container text-center">
          <h2 className="cta-title">¿Listo para comenzar?</h2>
          <p className="cta-desc">
            Ingresa con tus credenciales y descubre una nueva experiencia en gestión y aprendizaje educativo.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg">
            Ingresar a la Plataforma <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content text-center">
          <div className="footer-logo">
            <BookOpen size={22} className="footer-logo-icon" />
            <span>Aula Virtual Escolar</span>
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Aula Virtual Escolar. Todos los derechos reservados. Diseñado para la excelencia académica y tecnológica.
          </p>
        </div>
      </footer>
    </div>
  );
}
