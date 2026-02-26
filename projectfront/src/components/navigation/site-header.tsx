"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CseLogo } from "@/components/branding/cse-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/student", label: "Student" },
  { href: "/admin", label: "Admin" },
  { href: "/society", label: "Society member" },
];

const roleOptions = [
  { value: "student", label: "Student", icon: "🎓" },
  { value: "admin", label: "Admin", icon: "👨‍💼" },
  { value: "society", label: "Society Member", icon: "👥" },
];

export function SiteHeader() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const router = useRouter();

  const handleRoleSelect = (role: string, action: 'login' | 'signup') => {
    if (action === 'login') {
      setShowLoginModal(false);
      router.push(`/login?role=${role}`);
    } else {
      setShowSignUpModal(false);
      router.push(`/register?role=${role}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/20 bg-gradient-to-r from-[#1d3b72] via-[#2c4f8f] to-[#3a63ac] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <CseLogo className="h-10 w-auto" />
            <span className="tracking-tight">CSE society Event and Budget management System</span>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 text-base font-medium text-white/80 md:flex">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setShowLoginModal(true)}
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
          </div>
        </div>
      </header>

      {/* Login Role Selection Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {roleOptions.map((role) => (
              <label
                key={role.value}
                className="flex items-center gap-4 rounded-lg border border-border p-4 cursor-pointer"
              >
                <input
                  type="radio"
                  name="login-role"
                  value={role.value}
                  onChange={() => handleRoleSelect(role.value, 'login')}
                  className="h-4 w-4"
                />
                <h3 className="font-semibold">{role.label}</h3>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Up Role Selection Modal */}
      <Dialog open={showSignUpModal} onOpenChange={setShowSignUpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {roleOptions.map((role) => (
              <label
                key={role.value}
                className="flex items-center gap-4 rounded-lg border border-border p-4 cursor-pointer"
              >
                <input
                  type="radio"
                  name="signup-role"
                  value={role.value}
                  onChange={() => handleRoleSelect(role.value, 'signup')}
                  className="h-4 w-4"
                />
                <h3 className="font-semibold">{role.label}</h3>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
