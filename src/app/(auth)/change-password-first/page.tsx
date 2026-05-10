"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearAuthTokens } from "@/services/api";

export default function ChangePasswordFirstPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ mật khẩu mới.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api("/users/complete-password-setup", "PUT", {
        newPassword,
        confirmPassword,
      });
      clearAuthTokens();
      router.replace("/login?passwordChanged=1");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tạo mật khẩu mới."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-bold text-slate-900">Tạo mật khẩu mới</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tài khoản đang dùng mật khẩu tạm. Vui lòng đặt mật khẩu mới trước khi vào hệ thống.
      </p>

      <div className="mt-6 space-y-4">
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
          placeholder="Mật khẩu mới"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
          placeholder="Xác nhận mật khẩu"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : "Lưu mật khẩu mới"}
        </button>
      </div>
    </div>
  );
}
