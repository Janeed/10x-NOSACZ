import type { FC } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  readonly onCancel: () => void;
  readonly saving?: boolean;
  readonly isDirty?: boolean;
  readonly hasErrors?: boolean;
  readonly disabled?: boolean;
}

export const FormActions: FC<Props> = ({
  onCancel,
  saving = false,
  isDirty = false,
  hasErrors = false,
  disabled = false,
}) => {
  const isSaveDisabled = saving || disabled || hasErrors || !isDirty;
  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving || disabled}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isSaveDisabled}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
};
