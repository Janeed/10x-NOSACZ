import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps, FC, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const overlayVariants = cva(
  "fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in",
);

const contentVariants = cva(
  "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
);

export const Drawer: FC<DialogPrimitive.DialogProps> = ({
  children,
  ...props
}) => {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
};

export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerPortal = DialogPrimitive.Portal;
export const DrawerClose = DialogPrimitive.Close;

export const DrawerOverlay: FC<
  ComponentProps<typeof DialogPrimitive.Overlay>
> = ({ className, ...props }) => {
  return (
    <DialogPrimitive.Overlay
      className={cn(overlayVariants(), className)}
      {...props}
    />
  );
};

interface DrawerContentProps
  extends ComponentProps<typeof DialogPrimitive.Content> {
  readonly children: ReactNode;
}

export const DrawerContent: FC<DrawerContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        className={cn(contentVariants(), className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DrawerPortal>
  );
};

interface DrawerHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly onClose?: () => void;
  readonly closeDisabled?: boolean;
}

export const DrawerHeader: FC<DrawerHeaderProps> = ({
  title,
  description,
  onClose,
  closeDisabled,
}) => {
  return (
    <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
      <div>
        <DialogPrimitive.Title className="text-lg font-semibold text-slate-900">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-slate-600">
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </div>
      <DrawerClose
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        onClick={onClose}
        disabled={closeDisabled}
        aria-label="Close dialog"
      >
        <X className="size-4" aria-hidden="true" />
      </DrawerClose>
    </header>
  );
};

interface DrawerFooterProps {
  readonly children: ReactNode;
}

export const DrawerFooter: FC<DrawerFooterProps> = ({ children }) => {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
      {children}
    </div>
  );
};
