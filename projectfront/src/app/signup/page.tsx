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
          description="Choose a role to continue. Society member access is assigned by admin."
          actions={[
            { label: "Already have an account?", href: "/login", variant: "secondary" },
            { label: "Return home", href: "/", variant: "outline" },
          ]}
        />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <SectionCard
            title="Student"
            description="Create a student account directly."
          >
            <Link href="/register?role=student">
              <Button className="w-full">
                Register as Student
              </Button>
            </Link>
          </SectionCard>

          <SectionCard
            title="Society Member"
            description="Continue to society signup instructions."
          >
            <Link href="/register?role=society">
              <Button className="w-full" variant="outline">
                Continue as Society Member
              </Button>
            </Link>
          </SectionCard>

          <SectionCard
            title="Admin"
            description="Create an admin account with phone verification details."
          >
            <Link href="/register?role=admin">
              <Button className="w-full" variant="secondary">
                Register as Admin
              </Button>
            </Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
