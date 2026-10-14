import type { Metadata } from "next";
import Script from "next/script";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Role log · My job search",
  description: "A private dashboard for job applications"
};

const themeBootstrap = `try {
  document.documentElement.dataset.theme = localStorage.getItem("role-log-theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${sora.variable}`}>
      <Script id="role-log-theme" strategy="beforeInteractive">{themeBootstrap}</Script>
      <body>{children}</body>
    </html>
  );
}

