export const API_URL = "https://specializing-pool-many-placement.trycloudflare.com";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const REFRESH_THRESHOLD_SECONDS = 4 * 60;

const SESSION_EXPIRED_MESSAGE =
  "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.";
const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối hệ thống. Vui lòng kiểm tra mạng hoặc thử lại sau.";
const SERVER_ERROR_MESSAGE =
  "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
const GENERIC_ERROR_MESSAGE = "Có lỗi xảy ra. Vui lòng thử lại.";
const PUBLIC_ENDPOINTS = new Set([
  "/users/login",
  "/users/forgot-password",
  "/users/verify-reset-otp",
  "/users/reset-password",
]);

type TokenResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
};

let refreshPromise: Promise<string | null> | null = null;

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveAuthTokens(tokens: TokenResponse) {
  const accessToken = tokens.accessToken ?? tokens.token;

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearAuthTokens() {
  clearSession();
}

function getTokenSecondsLeft(token: string | null) {
  if (!token) {
    return 0;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };

    if (!payload.exp) {
      return 0;
    }

    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return 0;
  }
}

function handleExpiredSession(status: number) {
  if (status !== 401 && status !== 403) {
    return;
  }

  clearSession();

  if (window.location.pathname !== "/login") {
    window.location.replace("/login?expired=1");
  }
}

function getPayloadMessage(data: unknown) {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: string | string[] }).message;

    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

function getFriendlyMessage(
  status: number,
  data: unknown,
  fallback = GENERIC_ERROR_MESSAGE,
  authRequired = true
) {
  const payloadMessage = getPayloadMessage(data);

  if (authRequired && (status === 401 || status === 403)) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  if (payloadMessage) {
    return payloadMessage;
  }

  return fallback;
}

function isPublicEndpoint(endpoint: string) {
  return PUBLIC_ENDPOINTS.has(endpoint.split("?")[0]);
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/users/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(getFriendlyMessage(res.status, data, SESSION_EXPIRED_MESSAGE));
        }

        saveAuthTokens(data);
        return data.accessToken ?? data.token ?? null;
      })
      .catch((error) => {
        clearSession();

        if (error instanceof TypeError) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }

        throw error instanceof Error
          ? error
          : new Error(SESSION_EXPIRED_MESSAGE);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function getValidAccessToken() {
  const token = getAccessToken();
  const secondsLeft = getTokenSecondsLeft(token);

  if (token && secondsLeft > REFRESH_THRESHOLD_SECONDS) {
    return token;
  }

  return refreshAccessToken();
}

async function fetchWithAuth(
  endpoint: string,
  init: RequestInit,
  retry = true,
  authRequired = true
) {
  const token = authRequired ? await getValidAccessToken() : null;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (authRequired && res.status === 401 && retry && getRefreshToken()) {
    const nextToken = await refreshAccessToken().catch(() => null);

    if (nextToken) {
      headers.set("Authorization", `Bearer ${nextToken}`);
      return fetch(`${API_URL}${endpoint}`, {
        ...init,
        headers,
      });
    }
  }

  return res;
}

export const api = async <T>(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<T> => {
  let res: Response;
  const authRequired = !isPublicEndpoint(endpoint);

  try {
    res = await fetchWithAuth(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }, true, authRequired);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }

    throw error instanceof Error ? error : new Error(GENERIC_ERROR_MESSAGE);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (authRequired) {
      handleExpiredSession(res.status);
    }
    throw new Error(getFriendlyMessage(res.status, data, GENERIC_ERROR_MESSAGE, authRequired));
  }

  return data as T;
};

export const apiUploadFile = async <T>(
  endpoint: string,
  file: File,
  fieldName = "file",
  method = "PUT"
): Promise<T> => {
  const formData = new FormData();
  formData.append(fieldName, file);

  let res: Response;

  try {
    res = await fetchWithAuth(endpoint, {
      method,
      body: formData,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }

    throw error instanceof Error ? error : new Error(GENERIC_ERROR_MESSAGE);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    handleExpiredSession(res.status);
    throw new Error(
      getFriendlyMessage(res.status, data, "Không thể tải tệp lên. Vui lòng thử lại.")
    );
  }

  return data as T;
};
