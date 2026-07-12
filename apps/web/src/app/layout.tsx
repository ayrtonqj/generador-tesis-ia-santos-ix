import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'QJ — Sistema de Revisión Inteligente de Tesis',
  description: 'Gestión, revisión y evaluación automatizada de avances de tesis universitarias con inteligencia artificial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
