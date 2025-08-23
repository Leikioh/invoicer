import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invoicer",
  description: "App de facturation (clients, devis, factures)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100 text-gray-900`}>
        {/* Lien d'évitement pour l'accessibilité */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-black focus:text-white focus:rounded-md"
        >
          Aller au contenu
        </a>

        {/* Topbar */}
        <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-sm">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 rounded"
            >
              Invoicer
            </Link>

            <nav className="flex items-center gap-4 text-sm">
              <Link 
              href="/quotes" 
              className="text-black hover:underline">Devis
              </Link>
              
              <Link
                href="/invoices"
                className="text-black hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded px-1"
              >
                Factures
              </Link>
              <Link
                href="/invoices/new"
                className="text-black hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded px-1"
              >
                Nouvelle facture
              </Link>
              <Link
                href="/clients"
                className="text-black hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded px-1"
              >
                Clients
              </Link>

            </nav>
          </div>
        </header>

        {/* Contenu */}
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>

        {/* Footer light */}
        <footer className="mt-10 border-t text-xs text-gray-600">
          <div className="mx-auto max-w-6xl px-4 py-4">
            © {new Date().getFullYear()} Invoicer — Fait par Plaut Luke avec Next.js + Prisma
          </div>
        </footer>
      </body>
    </html>
  );
}
