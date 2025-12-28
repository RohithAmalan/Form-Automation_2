
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import { AuthProvider } from "../contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoForm AI",
  description: "AI-Powered Form Automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex text-white`}
      >
        <AuthProvider>
          <Sidebar />
          {/* Main Content Area: Offset by sidebar width */}
          <main className="flex-1 ml-64 min-h-screen p-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
