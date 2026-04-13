"use client";

import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

export default function SignupChoicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <PageHeader
          eyebrow="Get Started"
          title="Select Your Role"
          description=""
          actions={[
            { label: "Already have an account?", href: "/login", variant: "secondary" },
            { label: "Return home", href: "/", variant: "outline" },
          ]}
        />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Student Registration */}
          <SectionCard
            title="Student"
            description=""
          >
            <Link href="/register">
              <Button className="w-full">
                Register as Student
              </Button>
            </Link>
          </SectionCard>

          {/* Admin Registration */}
          <SectionCard
            title="Admin"
            description=""
          >
            <Link href="/admin/register">
              <Button className="w-full" variant="secondary">
                Register as Admin
              </Button>
            </Link>
          </SectionCard>

          {/* Society Member Registration */}
          <SectionCard
            title="Society Member"
            description=""
          >
            <Link href="/society-member/register">
              <Button className="w-full" variant="outline">
                Register as Society Member
              </Button>
            </Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
