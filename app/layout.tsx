import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aula Virtual",
  description: "Plataforma educativa moderna para instituciones de secundaria en Colombia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  );
}
