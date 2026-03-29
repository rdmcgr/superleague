import type { Metadata } from "next";
import "./globals.css";
import ShitTalkToast from "@/components/ShitTalkToast";

export const metadata: Metadata = {
  title: "World Cup 2026 Super League",
  description: "Private prediction league with chapter-based one-and-done team picks."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <main className="app-shell">
          {children}
          <ShitTalkToast />
          <footer className="mt-10 text-center text-xs text-slate-300/80">
            <p>© {year} SUPERLEAGUE.PARTY. An OWS joint.</p>
            <p>Made with ❤️ in PDX.</p>
          </footer>
        </main>
      </body>
    </html>
  );
}
