"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, Clock, User } from "lucide-react";
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
          
          <div className="navbar-user">
            <div className="user-text hidden md:block">
              <span className="user-name">{user?.name || "Usuario"}</span>
            </div>
            <div className="user-avatar" style={{ background: themeColor || "var(--primary-color)" }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
            </div>
          </div>
          
          <div className="navbar-actions">
            <LogoutButton />
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
              {links.map((link) => (
                <li key={link.href} className="nav-item-container">
                  <ActiveLink href={link.href}>
                    {link.icon}
                    <span className="nav-label">{link.label}</span>
                  </ActiveLink>
                </li>
              ))}
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
