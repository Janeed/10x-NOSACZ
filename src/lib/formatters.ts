const PLN_CURRENCY_FORMATTER = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return PLN_CURRENCY_FORMATTER.format(value);
};
