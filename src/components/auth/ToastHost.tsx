import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastMessage {
  id: string;
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: ToastMessage[];
  publish: (input: Omit<ToastMessage, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

const generateId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `toast-${Math.random().toString(36).slice(2, 10)}`;
};

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

/**
 * Provides toast state and renders toast notifications in a portal.
 */
export function ToastHost({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    setPortalNode(document.body);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const scheduleRemoval = useCallback(
    (id: string, duration: number | undefined) => {
      if (typeof window === "undefined") {
        return;
      }
      if (!duration || duration === Infinity) {
        return;
      }
      window.setTimeout(() => {
        dismiss(id);
      }, duration);
    },
    [dismiss],
  );

  const publish = useCallback<ToastContextValue["publish"]>(
    (input) => {
      const id = input.id ?? generateId();
      const variant = input.variant ?? "default";
      const duration = input.duration ?? DEFAULT_DURATION;

      setToasts((current) => {
        const filtered = current.filter((toast) => toast.id !== id);
        return [
          ...filtered,
          {
            id,
            title: input.title,
            description: input.description,
            variant,
            duration,
            action: input.action,
          },
        ];
      });

      scheduleRemoval(id, duration);
      return id;
    },
    [scheduleRemoval],
  );

  const value = useMemo<ToastContextValue>(() => {
    return {
      toasts,
      publish,
      dismiss,
    };
  }, [dismiss, publish, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalNode && toasts.length > 0
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
            >
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={cn(
                    "pointer-events-auto w-full max-w-sm rounded-xl border p-4 shadow-lg transition",
                    variantStyles[toast.variant ?? "default"],
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      {toast.title ? (
                        <p className="text-sm font-semibold leading-tight">
                          {toast.title}
                        </p>
                      ) : null}
                      <p className="text-sm leading-snug text-muted-foreground">
                        {toast.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {toast.action ? (
                        <button
                          type="button"
                          onClick={() => {
                            toast.action?.onClick?.();
                            dismiss(toast.id);
                          }}
                          className="rounded-md border border-transparent bg-foreground/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {toast.action.label}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => dismiss(toast.id)}
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>,
            portalNode,
          )
        : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);

  const showToast = useCallback(
    (input: Omit<ToastMessage, "id"> & { id?: string }) => {
      if (!context) {
        return "";
      }
      return context.publish(input);
    },
    [context],
  );

  const dismissToast = useCallback(
    (id: string) => {
      if (!context) {
        return;
      }
      context.dismiss(id);
    },
    [context],
  );

  return useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );
};
