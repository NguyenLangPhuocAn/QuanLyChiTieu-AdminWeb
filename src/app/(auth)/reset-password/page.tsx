"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, saveAuthTokens } from "@/services/api";

type Step = "EMAIL" | "OTP" | "PASSWORD";

type ResetPasswordResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  mustChangePassword?: boolean;
  message?: string;
};

const RESEND_COOLDOWN_SECONDS = 60;

function getJwtRole(token?: string) {
  if (!token) {
    return "";
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { role?: string };
    return payload.role ?? "";
  } catch {
    return "";
  }
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [step, setStep] = useState<Step>(initialToken ? "PASSWORD" : "EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async (isResend = false) => {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail) {
      setError("Vui lòng nhập email đã đăng ký.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await api<{ message: string }>("/users/forgot-password", "POST", {
        email: nextEmail,
      });
      setEmail(nextEmail);
      setOtp("");
      setResetToken("");
      setStep("OTP");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage(isResend ? "Đã gửi lại mã OTP." : result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể gửi mã OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await api<{ message: string; reset_token: string }>(
        "/users/verify-reset-otp",
        "POST",
        {
          email,
          otp: otp.trim(),
        }
      );
      setResetToken(result.reset_token);
      setStep("PASSWORD");
      setMessage(result.message || "Xác thực mã thành công.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Mã OTP không hợp lệ hoặc đã hết hạn."
      );
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    if (!resetToken.trim() || !newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ thông tin đặt lại mật khẩu.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await api<ResetPasswordResponse>("/users/reset-password", "POST", {
        reset_token: resetToken.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      const accessToken = result.accessToken ?? result.token;

      setMessage(result.message || "Đặt lại mật khẩu thành công.");

      if (getJwtRole(accessToken) === "ADMIN") {
        saveAuthTokens(result);
        setTimeout(() => {
          router.replace(result.mustChangePassword ? "/change-password-first" : "/");
        }, 800);
        return;
      }

      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === "EMAIL" ? "Quên mật khẩu" : step === "OTP" ? "Nhập mã OTP" : "Tạo mật khẩu mới";
  const caption =
    step === "EMAIL"
      ? "Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu."
      : step === "OTP"
        ? `Mã OTP đã được gửi đến ${email}.`
        : "Nhập mật khẩu mới để hoàn tất đặt lại mật khẩu.";

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{caption}</p>

      <div className="mt-6 space-y-4">
        {step === "EMAIL" ? (
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
              setMessage("");
            }}
            className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
            placeholder="Email"
          />
        ) : null}

        {step === "OTP" ? (
          <>
            <input
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
                setMessage("");
              }}
              className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-center text-2xl font-bold tracking-normal outline-none transition focus:border-orange-400"
              inputMode="numeric"
              maxLength={6}
              placeholder="Mã OTP"
            />
            <button
              type="button"
              onClick={() => requestOtp(true)}
              disabled={loading || cooldown > 0}
              className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm font-bold text-orange-600 transition hover:bg-orange-50 disabled:opacity-60"
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
            </button>
          </>
        ) : null}

        {step === "PASSWORD" ? (
          <>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setError("");
                setMessage("");
              }}
              className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              placeholder="Mật khẩu mới"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
                setMessage("");
              }}
              className="w-full rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              placeholder="Xác nhận mật khẩu"
            />
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <button
          type="button"
          onClick={
            step === "EMAIL" ? () => requestOtp() : step === "OTP" ? verifyOtp : submitNewPassword
          }
          disabled={loading}
          className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {loading
            ? "Đang xử lý..."
            : step === "EMAIL"
              ? "Gửi mã"
              : step === "OTP"
                ? "Xác nhận mã"
                : "Đổi mật khẩu"}
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
