import type { ReactNode } from "react";
import { AuthLayout } from "./AuthLayout";
import { AuthForm, type AuthMode } from "./AuthForm";

interface AuthViewProps {
  readonly mode: AuthMode;
  readonly title: string;
  readonly subtitle?: string;
  readonly footer?: ReactNode;
}

/**
 * Composes the shared auth layout with the interactive form so they hydrate within a single React island.
 */
export function AuthView({ mode, title, subtitle, footer }: AuthViewProps) {
  return (
    <AuthLayout title={title} subtitle={subtitle} footer={footer}>
      <AuthForm mode={mode} />
    </AuthLayout>
  );
}
