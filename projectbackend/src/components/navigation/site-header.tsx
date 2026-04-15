"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { CseLogo } from "@/components/branding/cse-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredUser, logout, isAuthenticated } from "@/lib/auth";
import type { User } from "@/lib/auth";

// Nav entry per role — only shown when user has that role
const ROLE_NAV: Record<string, { href: string; label: string }> = {
  student: { href: "/student", label: "Student" },
  society: { href: "/society", label: "Society" },
  admin:   { href: "/admin",   label: "Admin" },
};

const registerRoleOptions = [
  { value: "student", label: "Student",        icon: "🎓" },
  { value: "admin",   label: "Admin",          icon: "👨‍💼" },
  { value: "society", label: "Society Member", icon: "👥" },
];

export function SiteHeader() {
  const [user, setUser]               = useState<User | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  // Sync auth state on mount + whenever localStorage changes (e.g. login in another tab)
  useEffect(() => {
    const sync = () => setUser(isAuthenticated() ? getStoredUser() : null);
    sync();
    setMounted(true);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Re-sync on every navigation (handles login/logout within same tab)
  useEffect(() => {
    setUser(isAuthenticated() ? getStoredUser() : null);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.push("/");
  };

  const handleSignUpRoleSelect = (role: string) => {
    setShowSignUpModal(false);
    router.push(`/register?role=${role}`);
  };

  // Build nav links: Home always, then one per role the user holds
  const userNavLinks = user?.roles
    ? (user.roles.map((r) => ROLE_NAV[r]).filter(Boolean) as { href: string; label: string }[])
    : [];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/20 bg-linear-to-r from-[#1d3b72] via-[#2c4f8f] to-[#3a63ac] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <CseLogo className="h-10 w-auto" />
            <span className="tracking-tight">CSE Society Event & Budget Management</span>
          </Link>

          <div className="flex items-center gap-6">
            {/* Nav — always shows Home; shows role dashboards only when logged in */}
            <nav className="hidden items-center gap-6 text-base font-medium text-white/80 md:flex">
              <Link href="/" className="transition-colors hover:text-white">
                Home
              </Link>
              {mounted && userNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth controls */}
            {!mounted ? null : user ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-white/80 md:block">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => router.push("/login")}
                >
                  Login
                </Button>
                <Button
                  className="bg-white text-[#1d3b72] hover:bg-white/90"
                  onClick={() => setShowSignUpModal(true)}
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sign Up role picker modal */}
      <Dialog open={showSignUpModal} onOpenChange={setShowSignUpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {registerRoleOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="signup-role"
                  value={opt.value}
                  onChange={() => handleSignUpRoleSelect(opt.value)}
                  className="h-4 w-4"
                />
                <span className="text-xl">{opt.icon}</span>
                <h3 className="font-semibold">{opt.label}</h3>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
