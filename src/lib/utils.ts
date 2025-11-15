import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return email; // invalid email, return as is
  const maskedLocal = localPart.length > 1 ? localPart[0] + "***" : "***";
  return `${maskedLocal}@${domain}`;
}
