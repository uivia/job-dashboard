import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Dashboard",
  description: "A private dashboard for job applications"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

