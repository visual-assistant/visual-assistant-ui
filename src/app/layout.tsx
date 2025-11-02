import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual Assistant",
  description: "Outils internes PERGE — génération de liens et assistance visuelle",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <div className="text-xl font-semibold">
              Visual Assistant
              <span className="ml-2 text-sm text-gray-500">PERGE</span>
            </div>
            <nav className="text-sm text-gray-600">
              {/* Liens nav à venir */}
              <a href="/" className="hover:text-gray-900">Accueil</a>
              {/* <a href="/links" className="ml-6 hover:text-gray-900">Générateur de liens</a> */}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-gray-500">
            © {new Date().getFullYear()} PERGE — Visual Assistant
          </div>
        </footer>
      </body>
    </html>
  );
}
