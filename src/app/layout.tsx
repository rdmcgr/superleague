import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import ShitTalkToast from "@/components/ShitTalkToast";

export const metadata: Metadata = {
  title: "Super League",
  description: "Private prediction league with chapter-based one-and-done team picks.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png"
  }
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
            <p className="flex items-center justify-center gap-1">
              <span>© {year} SUPERLEAGUE.PARTY. AN</span>
              <Image
                alt="OWS"
                className="inline-block h-4 w-4 rounded-sm object-contain"
                height={16}
                src="/ows-nwo-logo.png"
                width={16}
              />
              <span>JOINT.</span>
            </p>
            <p>Made with ❤️ in PDX.</p>
          </footer>
        </main>
      </body>
    </html>
  );
}
