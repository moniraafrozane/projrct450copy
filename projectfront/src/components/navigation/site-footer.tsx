import Link from "next/link";
import { CalendarCheck, ClipboardList, Mail, MapPin, Phone, Wallet2 } from "lucide-react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/student", label: "Student workspace" },
  { href: "/admin", label: "Admin console" },
  { href: "/society", label: "Society hub" },
  { href: "/register", label: "Membership" },
];

const workflowLinks = [
  { href: "/society/budgets", label: "Budget ledger", icon: Wallet2 },
  { href: "/society/event-planner", label: "Event planner", icon: CalendarCheck },
  { href: "/admin/financial-records", label: "Financial records", icon: ClipboardList },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-gradient-to-r from-[#1b325e] via-[#243f78] to-[#385ea6] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">CSE Society</p>
            <p className="text-2xl font-semibold leading-tight">Budget & Event Command Center</p>
            <p className="text-sm text-white/80">
              Streamline approvals, maintain transparent ledgers, and keep every event on schedule from one shared workspace.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide">Navigate</p>
            <ul className="space-y-2 text-sm text-white/80">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <Link className="transition hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide">Workflows</p>
            <ul className="space-y-3 text-sm text-white/80">
              {workflowLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2 transition hover:text-white">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide">Contact</p>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                csesociety@sust.edu
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" aria-hidden="true" />
                +880 1555555007
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4" aria-hidden="true" />
                Shahjalal University of Science and Technology
              </li>
            </ul>
            <p className="text-xs text-white/70">Office hours: Sun–Thu · 9:00 AM – 5:00 PM</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 text-center text-xs text-white/70">
          CSE Society Budget & Event Management Workspace
        </div>
      </div>
    </footer>
  );
}
