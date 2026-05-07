export const API_URL = "http://localhost:3000";

function handleExpiredSession(status: number) {
  if (status !== 401 && status !== 403) {
    return;
  }

  localStorage.removeItem("token");

  if (window.location.pathname !== "/login") {
    window.location.replace("/login?expired=1");
  }
}

export const api = async <T>(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<T> => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
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
  const token = localStorage.getItem("token");
  const formData = new FormData();

  formData.append(fieldName, file);

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
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
