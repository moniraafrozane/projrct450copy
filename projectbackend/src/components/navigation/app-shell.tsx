"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [showSplash, setShowSplash] = useState(isHome);

  useEffect(() => {
    if (isHome) {
      setShowSplash(true);
      const timeout = setTimeout(() => setShowSplash(false), 1500);
      return () => clearTimeout(timeout);
    }
    setShowSplash(false);
  }, [isHome]);

  const splashScreen = (
    <div className="grid min-h-screen place-items-center bg-primary text-primary-foreground">
      <div className="text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.5em] text-primary-foreground/70">CSE Society</p>
        <h1 className="text-4xl font-semibold">Welcome to CSE Society</h1>
        <p className="text-sm text-primary-foreground/80">Preparing your workspace…</p>
      </div>
    </div>
  );

  if (isHome && showSplash) {
    return splashScreen;
  }

  return (
    <>
      {isHome && <SiteHeader />}
      {children}
      <SiteFooter />
    </>
  );
}
