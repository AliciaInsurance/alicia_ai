import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alicia AI",
  description: "Internal multi-assistant platform for Alicia customer chat",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
