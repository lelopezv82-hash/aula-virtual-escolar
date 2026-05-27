"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for desktop state
    const savedCollapsed = localStorage.getItem("sidebar_collapsed");
    if (savedCollapsed === "true") {
      setDesktopCollapsed(true);
    }

    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleDesktopCollapse = () => {
    const nextState = !desktopCollapsed;
    setDesktopCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
  };

  return (
    <div className={`dashboard-layout ${isMobile ? "mobile-mode" : "desktop-mode"} ${desktopCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Mobile Top Navbar */}
      {isMobile && (
        <header className="mobile-header">
          <button 
            onClick={() => setMobileOpen(true)} 
            className="mobile-menu-btn" 
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          <div className="mobile-header-brand">
            <BookOpen size={24} color="var(--primary-color)" />
            <span>{sidebarTitle}</span>
          </div>
          <div className="mobile-header-user">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.875rem", background: themeColor || "var(--primary-color)" }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
      )}

      {/* Backdrop for mobile drawer */}
      {isMobile && mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Aside */}
      <aside className={`sidebar ${isMobile ? "mobile" : ""} ${isMobile && mobileOpen ? "open" : ""} ${!isMobile && desktopCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-container">
            <BookOpen size={32} color="var(--primary-color)" className="brand-logo" />
            <h2 className="brand-text">{sidebarTitle}</h2>
          </div>
          {isMobile ? (
            <button 
              onClick={() => setMobileOpen(false)} 
              className="close-sidebar-btn" 
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          ) : (
            <button 
              onClick={toggleDesktopCollapse} 
              className="collapse-sidebar-btn" 
              title={desktopCollapsed ? "Expandir menú" : "Colapsar menú"}
              aria-label={desktopCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {desktopCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>
        
        <nav className="sidebar-nav">
          {links.map((link) => (
            <ActiveLink key={link.href} href={link.href}>
              {link.icon}
              <span className="nav-label">{link.label}</span>
            </ActiveLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar" style={{ background: themeColor || "var(--primary-color)" }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="details">
              <strong className="user-name">{user.name}</strong>
              <span className="user-role">{roleTitle}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
