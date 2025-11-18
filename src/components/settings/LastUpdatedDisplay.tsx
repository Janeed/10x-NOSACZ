import type { FC } from "react";

interface Props {
  readonly updatedAt?: string;
}

const format = (value?: string): string => {
  if (!value) {
    return "Not set yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set yet";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
};

export const LastUpdatedDisplay: FC<Props> = ({ updatedAt }) => {
  const display = format(updatedAt);
  return (
    <div className="text-xs text-slate-500">
      <span className="font-medium text-slate-600">Last updated:</span>{" "}
      <time dateTime={updatedAt ?? ""}>{display}</time>
    </div>
  );
};
