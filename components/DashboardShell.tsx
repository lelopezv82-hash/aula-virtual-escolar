"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, Clock, ChevronDown, UserCircle } from "lucide-react";
import LogoutButton from "./LogoutButton";
import ActiveLink from "./ActiveLink";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  hiddenSections?: string[];
  children?: { href: string; label: string; icon: React.ReactNode }[];
}

interface DashboardShellProps {
  user: {
    name?: string;
    email?: string;
  };
  roleTitle: string;
  sidebarTitle: string;
  links: NavLink[];
  children: React.ReactNode;
  themeColor?: string;
}

function CollapsibleNavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const isChildActive = link.children?.some(c => pathname.startsWith(c.href)) ?? false;
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  return (
    <li className="nav-item-container" style={{ flexDirection: "column", alignItems: "stretch", padding: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          padding: "0.6rem 1.5rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: isChildActive ? "var(--primary-color)" : "var(--text-secondary)",
          fontWeight: isChildActive ? 700 : 500,
          fontSize: "0.92rem",
          borderRadius: "0.5rem",
          transition: "background 0.15s, color 0.15s",
        }}
        className="hover:bg-orange-50 dark:hover:bg-orange-900/10"
      >
        <span style={{ color: isChildActive ? "var(--primary-color)" : "inherit" }}>{link.icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{link.label}</span>
        <ChevronDown
          size={15}
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(-180deg)" : "rotate(0deg)",
            opacity: 0.5,
          }}
        />
      </button>
      {open && (
        <ul style={{ paddingLeft: "1rem", marginBottom: "0.25rem" }}>
          {link.children!.map(child => (
            <li key={child.href} className="nav-item-container" style={{ marginBottom: "0.1rem" }}>
              <ActiveLink href={child.href}>
                {child.icon}
                <span className="nav-label">{child.label}</span>
              </ActiveLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DashboardShell({
  user,
  roleTitle,
  sidebarTitle,
  links,
  children,
  themeColor,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [courseExpandedState, setCourseExpandedState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pathname.startsWith("/estudiante/cursos/")) {
      const matched = links.find(l => l.href.startsWith("/estudiante/cursos/") && pathname.startsWith(l.href));
      if (matched) {
        setCourseExpandedState(prev => ({ ...prev, [matched.href]: true }));
      }
    }
  }, [pathname, links]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      };
      setTimeStr(new Date().toLocaleDateString('es-CO', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedState = localStorage.getItem("moodle_drawer_open");
    if (savedState === "false") {
      setDrawerOpen(false);
    }

    const checkSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setDrawerOpen(false);
      } else {
        const saved = localStorage.getItem("moodle_drawer_open");
        setDrawerOpen(saved !== "false");
      }
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [pathname, isMobile]);

  const toggleDrawer = () => {
    const nextState = !drawerOpen;
    setDrawerOpen(nextState);
    if (!isMobile) {
      localStorage.setItem("moodle_drawer_open", String(nextState));
    }
  };

  return (
    <div className={`moodle-layout ${isMobile ? "mobile" : "desktop"} ${drawerOpen ? "drawer-open" : "drawer-closed"}`}>
      {/* Top Navbar (Moodle style) */}
      <header className="moodle-navbar">
        <div className="navbar-left">
          <button 
            onClick={toggleDrawer} 
            className="navbar-toggler" 
            aria-label="Toggle navigation"
          >
            <Menu size={24} />
          </button>
          <div className="navbar-brand">
            <BookOpen size={24} color="var(--primary-color)" />
            <span className="brand-title">{sidebarTitle}</span>
          </div>
        </div>

        <div className="navbar-right">
          {!isMobile && (
            <div className="navbar-time">
              <Clock size={16} />
              <span className="capitalize">{timeStr}</span>
            </div>
          )}
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{ outline: "none" }}
            >
              <div className="bg-primary/10 text-primary rounded-full p-1">
                <UserCircle size={18} />
              </div>
              <div className="user-text hidden md:block text-left">
                <span className="user-name text-sm font-semibold text-gray-700">{user?.name || "Usuario"}</span>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${dropdownOpen ? "-rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden transform origin-top-right z-50 animate-scale-in">
                <div className="p-1.5">
                  <LogoutButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="moodle-body">
        {/* Backdrop for mobile */}
        {isMobile && drawerOpen && (
          <div className="moodle-backdrop" onClick={() => setDrawerOpen(false)} />
        )}

        {/* Side Drawer */}
        <aside className="moodle-drawer">
          {isMobile && (
            <div className="drawer-header-mobile">
              <span>Menú de Navegación</span>
              <button onClick={() => setDrawerOpen(false)} className="close-drawer">
                <X size={20} />
              </button>
            </div>
          )}

          {/* Welcome message */}
          <div style={{
            padding: "1.25rem 1.25rem 1rem",
            borderBottom: "1px solid var(--border-color)",
          }}>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Bienvenido/a
            </p>
            <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
              {user?.name || "Estudiante"}
            </p>
          </div>

          <nav className="drawer-nav">
            <ul className="nav-list">
              {roleTitle === "Estudiante" ? (
                <>
                  {/* Tablero Virtual */}
                  {links.filter(l => l.href === "/estudiante/tablero").map((link) => (
                    <li key={link.href} className="nav-item-container">
                      <ActiveLink href={link.href}>
                        {link.icon}
                        <span className="nav-label">{link.label}</span>
                      </ActiveLink>
                    </li>
                  ))}

                  {/* Separator */}
                  <li style={{ padding: "0.25rem 2rem" }}>
                    <div style={{ height: "1px", background: "var(--border-color)", margin: "0.25rem 0" }} />
                  </li>

                  {/* Asignaturas del estudiante con subsecciones integradas */}
                  {(() => {
                    const courseLinks = links.filter(l => l.href.startsWith("/estudiante/cursos/"));
                    return courseLinks.map((courseLink) => {
                      const isCourseActive = pathname.startsWith(courseLink.href);
                      const isRecursosActive = pathname === `${courseLink.href}/recursos` || pathname.startsWith(`${courseLink.href}/recursos/`);
                      const isCalifActive = pathname === `${courseLink.href}/calificaciones` || pathname.startsWith(`${courseLink.href}/calificaciones/`);
                      const isActividadesActive = isCourseActive && !isRecursosActive && !isCalifActive;

                      const isExpanded = courseExpandedState[courseLink.href] !== undefined
                        ? courseExpandedState[courseLink.href]
                        : isCourseActive;

                      const hiddenSections = courseLink.hiddenSections || [];
                      const showRecursos = !hiddenSections.includes("recursos");
                      const showActividades = !hiddenSections.includes("descripcion");
                      const showCalificaciones = !hiddenSections.includes("calificaciones");

                      return (
                        <React.Fragment key={courseLink.href}>
                          <li className="nav-item-container">
                            <Link
                              href={courseLink.href}
                              onClick={() => {
                                setCourseExpandedState(prev => ({ ...prev, [courseLink.href]: true }));
                                if (isMobile) setDrawerOpen(false);
                              }}
                              className="nav-item"
                              style={isCourseActive ? {
                                color: "var(--primary-color)",
                                fontWeight: 600,
                              } : undefined}
                            >
                              {courseLink.icon}
                              <span className="nav-label" style={{ flex: 1 }}>{courseLink.label}</span>
                              <span
                                role="button"
                                aria-label={isExpanded ? "Contraer opciones" : "Desplegar opciones"}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCourseExpandedState(prev => ({
                                    ...prev,
                                    [courseLink.href]: !isExpanded
                                  }));
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  backgroundColor: isExpanded ? "var(--primary-light)" : "var(--bg-tertiary)",
                                  border: isExpanded ? "1px solid rgba(249, 128, 18, 0.35)" : "1px solid var(--border-color)",
                                  color: isExpanded ? "var(--primary-color)" : "var(--text-secondary)",
                                  transition: "all 0.2s ease",
                                  flexShrink: 0,
                                }}
                                title={isExpanded ? "Contraer menú" : "Desplegar menú"}
                              >
                                <ChevronDown
                                  size={17}
                                  strokeWidth={2.5}
                                  style={{
                                    transform: isExpanded ? "rotate(-180deg)" : "rotate(0deg)",
                                    transition: "transform 0.25s ease",
                                  }}
                                />
                              </span>
                            </Link>
                          </li>

                          {isExpanded && (
                            <ul style={{
                              marginLeft: "1.75rem",
                              paddingLeft: "0.5rem",
                              margin: "0.25rem 0 0.5rem 1.75rem",
                              borderLeft: "2px solid rgba(249, 128, 18, 0.35)",
                              listStyle: "none"
                            }}>
                              {showRecursos && (
                                <li className="nav-item-container" style={{ padding: "0.1rem 0", marginBottom: "0.15rem" }}>
                                  <Link
                                    href={`${courseLink.href}/recursos`}
                                    onClick={() => { if (isMobile) setDrawerOpen(false); }}
                                    className={`nav-item ${isRecursosActive ? "active" : ""}`}
                                  >
                                    <span style={{ fontSize: "1.15rem", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px" }}>📚</span>
                                    <span className="nav-label">Recursos</span>
                                  </Link>
                                </li>
                              )}

                              {showActividades && (
                                <li className="nav-item-container" style={{ padding: "0.1rem 0", marginBottom: "0.15rem" }}>
                                  <Link
                                    href={courseLink.href}
                                    onClick={() => { if (isMobile) setDrawerOpen(false); }}
                                    className={`nav-item ${isActividadesActive ? "active" : ""}`}
                                  >
                                    <span style={{ fontSize: "1.15rem", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px" }}>📝</span>
                                    <span className="nav-label">Actividades</span>
                                  </Link>
                                </li>
                              )}

                              {showCalificaciones && (
                                <li className="nav-item-container" style={{ padding: "0.1rem 0", marginBottom: "0.15rem" }}>
                                  <Link
                                    href={`${courseLink.href}/calificaciones`}
                                    onClick={() => { if (isMobile) setDrawerOpen(false); }}
                                    className={`nav-item ${isCalifActive ? "active" : ""}`}
                                  >
                                    <span style={{ fontSize: "1.15rem", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px" }}>🏅</span>
                                    <span className="nav-label">Calificaciones</span>
                                  </Link>
                                </li>
                              )}
                            </ul>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}

                  {/* Separator + Configuración */}
                  <li style={{ padding: "0.25rem 2rem" }}>
                    <div style={{ height: "1px", background: "var(--border-color)", margin: "0.25rem 0" }} />
                  </li>
                  {links.filter(l => l.href === "/estudiante/configuracion").map((link) => (
                    <li key={link.href} className="nav-item-container">
                      <ActiveLink href={link.href}>
                        {link.icon}
                        <span className="nav-label">{link.label}</span>
                      </ActiveLink>
                    </li>
                  ))}
                </>
              ) : (
                links.map((link) => (
                  link.children ? (
                    <CollapsibleNavItem key={link.href} link={link} pathname={pathname} />
                  ) : (
                    <li key={link.href} className="nav-item-container">
                      <ActiveLink href={link.href}>
                        {link.icon}
                        <span className="nav-label">{link.label}</span>
                      </ActiveLink>
                    </li>
                  )
                ))
              )}
            </ul>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="moodle-main">
          <div className="moodle-content-wrapper">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
