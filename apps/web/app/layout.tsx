import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// DM Sans is a variable font on Google Fonts; not specifying `weight` lets
// next/font ship a single variable file (smaller than several static weights)
// and still serves any weight we request via Tailwind / CSS at runtime.
const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Chat — Omnichannel CRM",
  description:
    "Satukan WhatsApp, Instagram, Messenger, AI chatbot, dan multi-agent inbox dalam satu dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={dmSans.variable}>
      <body className="font-sans text-[14px] leading-[1.5] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
