import type { UserSettingsDto } from "@/types";

export interface SettingsFormValues {
  monthlyOverpaymentLimit: string;
  reinvestReducedPayments: boolean;
}

export interface SettingsFormErrors {
  monthlyOverpaymentLimit?: string;
  nonFieldError?: string;
}

export interface SettingsViewModel {
  dto?: UserSettingsDto;
  eTag?: string | null;
  isInitialized: boolean;
  status: "idle" | "loading" | "saving" | "error";
  error?: { message: string; code?: string };
  form: SettingsFormValues;
  formErrors: SettingsFormErrors;
  dirty: boolean;
  staleBannerVisible: boolean;
  saveResult?: "created" | "updated";
}
