import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToastHost } from "./ToastHost";
import { AuthLogo } from "./AuthLogo";

interface AuthLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

/**
 * Provides the shared structure for authentication pages including heading, card wrapper, and optional footer links.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthLayoutProps) {
  return (
    <ToastHost>
      <div className="grid min-h-svh place-items-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
        <main
          role="main"
          aria-labelledby="auth-layout-heading"
          className={cn("mx-auto w-full max-w-md space-y-8", className)}
        >
          <header className="space-y-2 text-center">
            <div className="mx-auto w-20 text-primary">
              <AuthLogo />
            </div>
            <h1
              id="auth-layout-heading"
              className="text-3xl font-semibold tracking-tight text-primary"
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </header>

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
            {children}
          </section>

          {footer ? (
            <footer className="text-center text-sm text-muted-foreground">
              {footer}
            </footer>
          ) : null}
        </main>
      </div>
    </ToastHost>
  );
}
