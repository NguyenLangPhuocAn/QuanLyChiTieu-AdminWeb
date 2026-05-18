"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim() || !newPassword || !confirmPassword) {
      setError("Vui lòng nhập mã reset và mật khẩu mới.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await api<{ message: string }>("/users/reset-password", "POST", {
        token: token.trim(),
        newPassword,
        confirmPassword,
      });
      setMessage(result.message || "Đặt lại mật khẩu thành công.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Đặt lại mật khẩu</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Nhập mã trong email và tạo mật khẩu mới cho tài khoản.
      </p>

      <div className="mt-6 space-y-4">
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
          placeholder="Mã đặt lại mật khẩu"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
          placeholder="Mật khẩu mới"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
          placeholder="Xác nhận mật khẩu"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
