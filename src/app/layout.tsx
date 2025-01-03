// src/app/layout.tsx

import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from '@/components/providers/AuthProvider';
import Navigation from '@/components/Navigation';
import { Play } from "next/font/google";
import { WebSocketProviderWrapper } from "@/components/providers/WebSocketProviderWrapper";
import { NotificationProvider } from "@/components/providers/NotificationProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const play = Play({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-play',
});


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${play.variable} antialiased min-h-full flex flex-col`}>
        <AuthProvider>
          <WebSocketProviderWrapper>
            <NotificationProvider>
              <Navigation />
              <main className="flex-1 pt-16">
                {children}
              </main>
            </NotificationProvider>
          </WebSocketProviderWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}