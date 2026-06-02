'use client'

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessaoProvider } from '@/context/SessaoContext'


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessaoProvider>
          {children}
        </SessaoProvider>
      </body>
    </html>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${geistSans.className} font-sans min-h-full flex flex-col bg-zinc-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
