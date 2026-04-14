import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeaderAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "accent" | "outline" | "ghost" | "destructive";
};

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: HeaderAction[];
  className?: string;
  aside?: ReactNode;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  aside,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-3xl border border-border bg-linear-to-br from-card to-card/80 p-8 text-foreground shadow-sm md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="space-y-4">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground md:text-xl">{description}</p>
        </div>
        {actions?.length ? (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              action.href ? (
                <Button
                  key={action.label}
                  asChild
                  variant={action.variant ?? "default"}
                >
                  <a href={action.href}>{action.label}</a>
                </Button>
              ) : (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? "default"}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )
            ))}
          </div>
        ) : null}
      </div>
      {aside ? <div className="w-full max-w-sm text-sm text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
