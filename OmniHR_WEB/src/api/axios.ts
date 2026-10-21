// Axios client dùng chung cho mọi lời gọi API.
// - Tự gắn access token vào header Authorization.
// - Gặp 401 thì tự làm mới token bằng refresh token rồi gửi lại request (nhiều request cùng lúc chỉ refresh một lần);
//   làm mới thất bại thì đăng xuất.

import axios, { AxiosError } from "axios";
import type { ApiEnvelope, LoginResponse } from "./types";
import { authStore } from "../store/auth";
import { getCurrentLanguage, translateText } from "../i18n";

// Địa chỉ backend, lấy từ VITE_API_BASE_URL.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

// Bắt 401: refresh token một lần (dùng chung refreshPromise) rồi gửi lại request gốc.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;

      refreshPromise ??= refreshAccessToken();
      const token = await refreshPromise.finally(() => {
        refreshPromise = null;
      });

      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  }
);

// Gọi /auth/refresh; thành công thì lưu token mới, thất bại thì xóa phiên đăng nhập.
async function refreshAccessToken() {
  const refreshToken = authStore.getState().refreshToken;
  if (!refreshToken) {
    authStore.getState().logoutLocal();
    return null;
  }

  try {
    const response = await axios.post<ApiEnvelope<LoginResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken }
    );
    authStore.getState().setSession(response.data.data);
    return response.data.data.accessToken;
  } catch {
    authStore.getState().logoutLocal();
    return null;
  }
}

// Lấy thông báo lỗi dễ đọc từ lỗi API (đã dịch theo ngôn ngữ đang chọn).
export function getApiErrorMessage(error: unknown) {
  const language = getCurrentLanguage();

  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return (
      translateText(language, error.response?.data?.message) ||
      translateText(language, error.message)
    );
  }
  return error instanceof Error
    ? translateText(language, error.message)
    : translateText(language, "Request failed");
}
