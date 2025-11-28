import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import './fonts.css';
import ReactQueryProvider from "@/provider/ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conversies | Современное решение для общения",
  description: "Conversies - современное решение для общения с друзьями и близкими",
  icons: ["../public/assets/logo.PNG"],
  metadataBase: new URL('https://conversies.vercel.app'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="yandex-verification" content="0a58f104740674d0" />
      </head>
      <ReactQueryProvider>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
      </ReactQueryProvider>
    </html>
  );
}
