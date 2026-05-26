"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ActiveLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

export default function ActiveLink({
  href,
  children,
  className = "nav-item",
  activeClassName = "active",
}: ActiveLinkProps) {
  const pathname = usePathname();
  
  // Exact match for base dashboard paths, prefix match for sub-routes
  const isActive =
    href === "/docente" || href === "/estudiante"
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <Link href={href} className={`${className} ${isActive ? activeClassName : ""}`}>
      {children}
    </Link>
  );
}
