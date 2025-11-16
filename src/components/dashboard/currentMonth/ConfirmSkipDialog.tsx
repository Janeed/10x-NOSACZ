import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

interface ConfirmSkipDialogProps {
  readonly open: boolean;
  readonly loanId?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isSubmitting?: boolean;
}

const dialogRoot = () => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.body;
};

export function ConfirmSkipDialog({
  open,
  loanId,
  onConfirm,
  onCancel,
  isSubmitting,
}: ConfirmSkipDialogProps) {
  const portalTarget = dialogRoot();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    lastFocusedRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) {
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus({ preventScroll: true });
      }
      return;
    }

    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  if (!open || !portalTarget) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      role="button"
      aria-label="Dismiss skip confirmation dialog"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" ||
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-skip-title"
        aria-describedby="confirm-skip-description"
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <div className="space-y-2">
          <h2
            id="confirm-skip-title"
            className="text-lg font-semibold text-foreground"
          >
            Skip overpayment?
          </h2>
          <p
            id="confirm-skip-description"
            className="text-sm text-muted-foreground"
          >
            Skipping this overpayment might delay your payoff timeline. Are you
            sure you want to mark the overpayment for loan #{loanId ?? ""} as
            skipped?
          </p>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            Confirm skip
          </Button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
