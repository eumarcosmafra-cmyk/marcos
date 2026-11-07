import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/state/toast";
import { UnsavedGuardProvider } from "@/state/unsaved-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MAFRA LABS — Editorial", template: "%s · MAFRA LABS — Editorial" },
  description: "Gestão editorial de SEO: pautas, briefings, revisão de artigos e aprovações humanas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <UnsavedGuardProvider>{children}</UnsavedGuardProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
