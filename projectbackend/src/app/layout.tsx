import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/navigation/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CSE Society Budget & Event Management",
  description:
    "Role-specific workspaces for students, admins, and society members overseeing campus budgets and events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppShell>
          <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-6 py-10">{children}</main>
        </AppShell>
      </body>
    </html>
  );
}
