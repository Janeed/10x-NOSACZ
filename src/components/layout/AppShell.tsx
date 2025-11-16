import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Menu, PanelRightOpen } from "lucide-react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "loans", label: "Loans", href: "/loans" },
] as const;

export type AppNavKey = (typeof NAV_ITEMS)[number]["key"];

interface AppShellProps {
  readonly children: ReactNode;
  readonly activeNav?: AppNavKey;
  readonly title?: string;
}

export function AppShell({
  children,
  activeNav = "dashboard",
  title,
}: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.matchMedia("(max-width: 1024px)").matches) {
      setIsCollapsed(true);
    }
  }, []);

  const navItems = useMemo(() => NAV_ITEMS, []);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border/60 px-3 py-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={
              isCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((current) => !current)}
          >
            {isCollapsed ? (
              <PanelRightOpen className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </Button>
          <a
            href="/dashboard"
            className="flex items-center gap-3 text-inherit"
            aria-label="NOSACZ home"
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center",
                isCollapsed && "h-8 w-8",
              )}
            >
              <AuthLogo />
            </span>
            {isCollapsed ? null : (
              <span className="text-base font-semibold tracking-tight">
                NOSACZ
              </span>
            )}
          </a>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <a
                key={item.key}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  isCollapsed ? "justify-center" : "justify-start",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md bg-sidebar-accent/50 text-sm font-semibold text-sidebar-foreground",
                    isCollapsed ? "size-10" : "size-9",
                    isActive && "bg-primary/15 text-primary",
                  )}
                  aria-hidden="true"
                >
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                {isCollapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border/60 px-3 py-3 text-xs text-sidebar-foreground/60">
          {title ? <p className="truncate">{title}</p> : null}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="min-h-screen w-full">{children}</div>
      </div>
    </div>
  );
}
