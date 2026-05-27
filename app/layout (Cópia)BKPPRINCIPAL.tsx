import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barber System",
  description: "Sistema para Barbearia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 1. Mudamos o idioma para pt-BR
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* 2. Aplicamos a classe geistSans.className e a classe font-sans aqui */}
      <body className={`${geistSans.className} font-sans min-h-full flex flex-col bg-zinc-950 text-white`}>
        {children}
      </body>
    </html>
  );
}