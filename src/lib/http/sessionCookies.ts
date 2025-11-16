const SESSION_ACCESS_TOKEN_COOKIE = "nosacz_access_token";
const SESSION_REFRESH_TOKEN_COOKIE = "nosacz_refresh_token";

const ONE_HOUR_SECONDS = 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const COOKIE_DATE_EPOCH = "Thu, 01 Jan 1970 00:00:00 GMT";

const isSecureCookie = import.meta.env?.PROD ?? false;

const createExpiry = (maxAgeSeconds: number): string => {
  if (maxAgeSeconds <= 0) {
    return COOKIE_DATE_EPOCH;
  }

  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
  return expiresAt.toUTCString();
};

const encodeValue = (value: string): string => {
  return encodeURIComponent(value);
};

const serializeCookie = (
  name: string,
  value: string,
  maxAgeSeconds: number,
  httpOnly = true,
): string => {
  const segments = [
    `${name}=${encodeValue(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, maxAgeSeconds)}`,
    `Expires=${createExpiry(maxAgeSeconds)}`,
    "SameSite=Lax",
  ];

  if (httpOnly) {
    segments.push("HttpOnly");
  }

  if (isSecureCookie) {
    segments.push("Secure");
  }

  return segments.join("; ");
};

const parseCookieHeader = (header: string | null): Record<string, string> => {
  if (!header) {
    return {};
  }

  const result: Record<string, string> = {};
  const pairs = header.split(";");

  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }

    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const value = rest.join("=");
    result[name] = decodeURIComponent(value);
  }

  return result;
};

export interface SessionCookieValues {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export const buildSessionCookies = (
  values: SessionCookieValues,
): readonly string[] => {
  const accessCookie = serializeCookie(
    SESSION_ACCESS_TOKEN_COOKIE,
    values.accessToken,
    ONE_HOUR_SECONDS,
  );

  const refreshCookie = serializeCookie(
    SESSION_REFRESH_TOKEN_COOKIE,
    values.refreshToken,
    THIRTY_DAYS_SECONDS,
  );

  return [accessCookie, refreshCookie];
};

export const buildSessionClearCookies = (): readonly string[] => {
  const accessCookie = serializeCookie(
    SESSION_ACCESS_TOKEN_COOKIE,
    "",
    0,
  );

  const refreshCookie = serializeCookie(
    SESSION_REFRESH_TOKEN_COOKIE,
    "",
    0,
  );

  return [accessCookie, refreshCookie];
};

export const readAccessTokenFromCookies = (
  cookieHeader: string | null,
): string | undefined => {
  const cookies = parseCookieHeader(cookieHeader);
  const value = cookies[SESSION_ACCESS_TOKEN_COOKIE];
  return value ? value : undefined;
};

export const readRefreshTokenFromCookies = (
  cookieHeader: string | null,
): string | undefined => {
  const cookies = parseCookieHeader(cookieHeader);
  const value = cookies[SESSION_REFRESH_TOKEN_COOKIE];
  return value ? value : undefined;
};

export const SESSION_COOKIE_NAMES = {
  access: SESSION_ACCESS_TOKEN_COOKIE,
  refresh: SESSION_REFRESH_TOKEN_COOKIE,
} as const;
