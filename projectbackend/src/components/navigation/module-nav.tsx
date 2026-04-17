"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ModuleNavItem = {
  href: string;
  label: string;
};

export function ModuleNav({ items }: { items: ModuleNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-3">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border/80 text-foreground hover:border-primary/60"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
