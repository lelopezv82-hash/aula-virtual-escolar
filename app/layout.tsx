import type { Metadata } from "next";
import "./globals.css";
import { ConfirmProvider } from "@/components/ConfirmProvider";

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
        <ConfirmProvider>
          <main className="app-container">
            {children}
          </main>
        </ConfirmProvider>
      </body>
    </html>
  );
}
