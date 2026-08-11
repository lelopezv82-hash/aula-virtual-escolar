"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, Clock, ChevronDown, UserCircle } from "lucide-react";
import LogoutButton from "./LogoutButton";
import ActiveLink from "./ActiveLink";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
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
              {roleTitle === "Estudiante" && links.some(l => l.href.startsWith("/estudiante/cursos/")) ? (
                <>
                  <li style={{ 
                    padding: "0.5rem 2rem 0.25rem", 
                    fontSize: "0.75rem", 
                    color: "var(--text-muted)", 
                    fontWeight: 600, 
                    textTransform: "uppercase", 
                    letterSpacing: "0.05em" 
                  }}>
                    Asignaturas
                  </li>
                  {links.filter(l => l.href.startsWith("/estudiante/cursos/")).map((link) => (
                    <li key={link.href} className="nav-item-container">
                      <ActiveLink href={link.href}>
                        {link.icon}
                        <span className="nav-label">{link.label}</span>
                      </ActiveLink>
                    </li>
                  ))}
                  {links.some(l => !l.href.startsWith("/estudiante/cursos/")) && (
                    <li style={{ padding: "0.25rem 2rem" }}>
                      <div style={{ height: "1px", background: "var(--border-color)", margin: "0.25rem 0" }} />
                    </li>
                  )}
                  {links.filter(l => !l.href.startsWith("/estudiante/cursos/")).map((link) => (
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
                  <li key={link.href} className="nav-item-container">
                    <ActiveLink href={link.href}>
                      {link.icon}
                      <span className="nav-label">{link.label}</span>
                    </ActiveLink>
                  </li>
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
