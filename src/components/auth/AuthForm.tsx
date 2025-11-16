import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { z } from "zod";

import type { AuthSigninRequest, AuthSignupRequest } from "@/types";
import { ErrorSummary, type ErrorItem } from "./ErrorSummary";
import { FormActions } from "./FormActions";
import { PasswordInput } from "./PasswordInput";
import { TextInput } from "./TextInput";
import { useToast } from "./ToastHost";
import { useAuthApi } from "@/lib/hooks/useAuthApi";
import { useSession, type SessionTokens } from "@/lib/hooks/useSession";
import { authSigninSchema, authSignupSchema } from "@/lib/validation/auth";

export type AuthMode = "signin" | "signup";

interface AuthFormProps {
  readonly mode: AuthMode;
  readonly onSuccess?: (session: SessionTokens) => void;
}

interface FieldErrors {
  email?: string;
  password?: string;
  _form?: string;
}

interface TouchedState {
  email: boolean;
  password: boolean;
}

const EMAIL_ERROR_MESSAGE = "Enter a valid email address.";
const PASSWORD_ERROR_MESSAGE = "Password must be between 8 and 128 characters.";
const DASHBOARD_ROUTE = "/dashboard";

const FORM_COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  signin: {
    title: "Sign in",
    subtitle: "Enter your credentials to continue",
  },
  signup: {
    title: "Create your account",
    subtitle: "Use a valid email address and a secure password",
  },
};

const SUCCESS_TOAST_COPY: Record<
  AuthMode,
  { title: string; description: string }
> = {
  signin: {
    title: "Signed in",
    description: "Redirecting to your dashboard...",
  },
  signup: {
    title: "Account created",
    description: "Redirecting to your dashboard...",
  },
};

const RATE_LIMIT_COOLDOWN_MS = 10000;

const parseEmail = (value: string) => {
  const result = authSigninSchema.shape.email.safeParse(value);
  if (!result.success) {
    return { success: false as const, message: EMAIL_ERROR_MESSAGE };
  }
  return { success: true as const, value: result.data };
};

const parsePassword = (value: string) => {
  const result = authSigninSchema.shape.password.safeParse(value);
  if (!result.success) {
    return { success: false as const, message: PASSWORD_ERROR_MESSAGE };
  }
  return { success: true as const, value: result.data };
};

const buildValidationErrors = (
  error: z.ZodError<AuthSigninRequest | AuthSignupRequest>,
) => {
  const flattened = error.flatten().fieldErrors;
  const errors: FieldErrors = {};

  if (flattened.email && flattened.email.length > 0) {
    errors.email = EMAIL_ERROR_MESSAGE;
  }

  if (flattened.password && flattened.password.length > 0) {
    errors.password = PASSWORD_ERROR_MESSAGE;
  }

  return errors;
};

const mapServerError = (
  mode: AuthMode,
  status: number,
  code: string,
): string => {
  if (code === "NETWORK_ERROR") {
    return "Network error. Please check your connection and try again.";
  }

  if (code === "RATE_LIMITED" || status === 429) {
    return "Too many attempts. Try again later.";
  }

  if (code === "VALIDATION_ERROR" || status === 400) {
    return "Check your input and try again.";
  }

  if (mode === "signin") {
    if (code === "INVALID_CREDENTIALS" || status === 401) {
      return "Invalid email or password.";
    }
  }

  if (mode === "signup" && code === "EMAIL_EXISTS") {
    return "Email already registered.";
  }

  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }

  return "Unable to complete request. Please try again.";
};

const getSecondaryLinks = (mode: AuthMode) => {
  if (mode === "signin") {
    return [
      { href: "/auth/signup", label: "Create account" },
      {
        href: "/auth/reset-password",
        label: "Forgot password?",
        variant: "ghost" as const,
      },
    ];
  }

  return [{ href: "/auth/signin", label: "Already have an account?" }];
};

const getSubmitLabel = (mode: AuthMode) => {
  return mode === "signin" ? "Sign in" : "Create account";
};

/**
 * Shared authentication form that handles validation, submission, and error presentation for signin/signup.
 */
export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<TouchedState>({
    email: false,
    password: false,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [requestId, setRequestId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [cooldownSecondsRemaining, setCooldownSecondsRemaining] = useState(0);

  const { signin, signup } = useAuthApi();
  const { saveSession } = useSession();
  const { showToast } = useToast();

  const schema = mode === "signin" ? authSigninSchema : authSignupSchema;

  const summaryErrors = useMemo<ErrorItem[]>(() => {
    const errors: ErrorItem[] = [];
    if (serverError) {
      errors.push({ message: serverError });
    }
    if (fieldErrors._form) {
      errors.push({ message: fieldErrors._form });
    }
    return errors;
  }, [fieldErrors._form, serverError]);

  const isCooldownActive = cooldownSecondsRemaining > 0;

  const applyFieldError = useCallback(
    (name: keyof FieldErrors, message?: string) => {
      setFieldErrors((current) => ({ ...current, [name]: message }));
    },
    [],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (fieldErrors.email) {
        applyFieldError("email", undefined);
      }
    },
    [applyFieldError, fieldErrors.email],
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      if (fieldErrors.password) {
        applyFieldError("password", undefined);
      }
    },
    [applyFieldError, fieldErrors.password],
  );

  const validateEmailField = useCallback(
    (value: string) => {
      const result = parseEmail(value);
      applyFieldError("email", result.success ? undefined : result.message);
      return result.success;
    },
    [applyFieldError],
  );

  const validatePasswordField = useCallback(
    (value: string) => {
      const result = parsePassword(value);
      applyFieldError("password", result.success ? undefined : result.message);
      return result.success;
    },
    [applyFieldError],
  );

  const handleEmailBlur = useCallback(() => {
    setTouched((current) => ({ ...current, email: true }));
    validateEmailField(email);
  }, [email, validateEmailField]);

  const handlePasswordBlur = useCallback(() => {
    setTouched((current) => ({ ...current, password: true }));
    validatePasswordField(password);
  }, [password, validatePasswordField]);

  const resetSubmissionState = useCallback(() => {
    setServerError(undefined);
    setRequestId(undefined);
    setFieldErrors((current) => ({
      ...current,
      _form: undefined,
    }));
  }, []);

  const defaultOnSuccess = useCallback(() => {
    window.location.assign(DASHBOARD_ROUTE);
  }, []);

  useEffect(() => {
    if (!cooldownEndsAt) {
      setCooldownSecondsRemaining(0);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const updateRemaining = () => {
      if (!cooldownEndsAt) {
        return;
      }
      const remainingMs = cooldownEndsAt - Date.now();
      if (remainingMs <= 0) {
        setCooldownEndsAt(null);
        setCooldownSecondsRemaining(0);
        return;
      }
      setCooldownSecondsRemaining(Math.ceil(remainingMs / 1000));
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownEndsAt]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (cooldownEndsAt && cooldownEndsAt > Date.now()) {
        return;
      }

      resetSubmissionState();

      const parsed = schema.safeParse({ email, password });
      if (!parsed.success) {
        const validationErrors = buildValidationErrors(parsed.error);
        setFieldErrors((current) => ({
          ...current,
          ...validationErrors,
        }));
        setTouched({ email: true, password: true });
        return;
      }

      const payload = parsed.data;
      setEmail(payload.email);
      setIsSubmitting(true);

      const request =
        mode === "signin"
          ? await signin(payload as AuthSigninRequest)
          : await signup(payload as AuthSignupRequest);

      setIsSubmitting(false);

      if (!request.success) {
        const message = mapServerError(
          mode,
          request.error.status,
          request.error.code,
        );
        setServerError(message);
        setRequestId(request.error.requestId);

        if (
          request.error.status === 429 ||
          request.error.code === "RATE_LIMITED"
        ) {
          const end = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          setCooldownEndsAt(end);
          setCooldownSecondsRemaining(Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000));
        }
        return;
      }

      setRequestId(undefined);
      setCooldownEndsAt(null);
      setCooldownSecondsRemaining(0);

      const session = request.data.session;
      const toastCopy = SUCCESS_TOAST_COPY[mode];
      showToast({
        title: toastCopy.title,
        description: toastCopy.description,
        variant: "success",
      });
      saveSession(session);
      const successHandler = onSuccess ?? defaultOnSuccess;
      successHandler(session);
    },
    [
      cooldownEndsAt,
      defaultOnSuccess,
      email,
      mode,
      onSuccess,
      password,
      resetSubmissionState,
      saveSession,
      schema,
      showToast,
      signin,
      signup,
    ],
  );

  return (
    <form className="space-y-6 p-6" onSubmit={handleSubmit} noValidate>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">
          {FORM_COPY[mode].title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {FORM_COPY[mode].subtitle}
        </p>
      </header>

      {summaryErrors.length > 0 ? (
        <ErrorSummary
          errors={summaryErrors}
          supportDetails={
            requestId
              ? {
                  summary: "Support details",
                  content: `Request ID: ${requestId}`,
                }
              : undefined
          }
        />
      ) : null}

      <div className="space-y-4">
        <TextInput
          id="email"
          label="Email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          error={touched.email ? fieldErrors.email : undefined}
          autoComplete="email"
          disabled={isSubmitting}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          error={touched.password ? fieldErrors.password : undefined}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          disabled={isSubmitting}
        />
      </div>

      <FormActions
        submitLabel={getSubmitLabel(mode)}
        isSubmitting={isSubmitting}
        isDisabled={isCooldownActive}
        disabledLabel={
          isCooldownActive && cooldownSecondsRemaining > 0
            ? `Try again in ${cooldownSecondsRemaining}s`
            : undefined
        }
        secondaryLinks={getSecondaryLinks(mode)}
      />
    </form>
  );
}
