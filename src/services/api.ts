export const API_URL = "http://localhost:3000";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const REFRESH_THRESHOLD_SECONDS = 4 * 60;

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
          throw new Error(data?.message || "Phiên đăng nhập đã hết hạn");
        }

        saveAuthTokens(data);
        return data.accessToken ?? data.token ?? null;
      })
      .catch((error) => {
        clearSession();
        throw error;
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

async function fetchWithAuth(endpoint: string, init: RequestInit, retry = true) {
  const token = await getValidAccessToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && retry && getRefreshToken()) {
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
  const res = await fetchWithAuth(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    handleExpiredSession(res.status);

    const message =
      data && typeof data === "object" && "message" in data
        ? Array.isArray(data.message)
          ? data.message.join(", ")
          : String(data.message)
        : "Có lỗi xảy ra khi gọi API.";

    throw new Error(message);
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

  const res = await fetchWithAuth(endpoint, {
    method,
    body: formData,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    handleExpiredSession(res.status);

    const message =
      data && typeof data === "object" && "message" in data
        ? Array.isArray(data.message)
          ? data.message.join(", ")
          : String(data.message)
        : "Có lỗi xảy ra khi upload file.";

    throw new Error(message);
  }

  return data as T;
};