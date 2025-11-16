import type { ChartInterestPointVM } from "@/types/dashboard";

interface InterestAccessibleTableProps {
  readonly points: ChartInterestPointVM[] | undefined;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMonth = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export function InterestAccessibleTable({
  points,
}: InterestAccessibleTableProps) {
  if (!points || points.length === 0) {
    return null;
  }

  return (
    <table className="min-w-full border-separate border-spacing-y-2 text-sm">
      <caption className="text-left text-sm font-medium text-muted-foreground">
        Interest charged versus interest saved each month
      </caption>
      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th scope="col" className="text-left font-medium">
            Month
          </th>
          <th scope="col" className="text-left font-medium">
            Interest charged
          </th>
          <th scope="col" className="text-left font-medium">
            Interest saved
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr
            key={String(point.month)}
            className="rounded border border-transparent"
          >
            <td className="py-1 pr-6 font-medium text-foreground">
              {formatMonth(point.month)}
            </td>
            <td className="py-1 text-muted-foreground">
              {formatCurrency(point.interest)}
            </td>
            <td className="py-1 text-muted-foreground">
              {formatCurrency(point.interestSaved)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
