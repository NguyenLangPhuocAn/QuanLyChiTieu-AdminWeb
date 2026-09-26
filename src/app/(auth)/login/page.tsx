"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL, api, clearAuthTokens, saveAuthTokens } from "../../../services/api";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

type LoginResponse = {
  token: string;
  accessToken?: string;
  refreshToken?: string;
  mustChangePassword?: boolean;
};

type CurrentUser = {
  must_change_password?: boolean | number | null;
};

type ForgotStep = "EMAIL" | "OTP" | "PASSWORD";

type ResetPasswordResponse = LoginResponse & {
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

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expiredMessage =
    searchParams.get("expired") === "1"
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : "";

  // state form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // state UI
  const [error, setError] = useState(expiredMessage);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("EMAIL");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    const checkToken = async () => {
      try {
        const user = await api<CurrentUser>("/users/me");
        if (user.must_change_password) {
          router.replace("/change-password-first");
          return;
        }
        router.replace("/");
      } catch {
        clearAuthTokens();
      }
    };

    void checkToken();
  }, [router]);

  useEffect(() => {
    const callbackParams = new URLSearchParams(searchParams.toString());

    if (window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      hashParams.forEach((value, key) => {
        callbackParams.set(key, value);
      });
    }

    const googleError = callbackParams.get("googleError");
    const accessToken = callbackParams.get("token");
    const refreshToken = callbackParams.get("refreshToken");
    const mustChangePassword = callbackParams.get("mustChangePassword") === "1";

    if (googleError) {
      const timer = window.setTimeout(() => {
        setError(decodeURIComponent(googleError));
      }, 0);

      return () => window.clearTimeout(timer);
    }

    if (!accessToken) {
      return;
    }

    saveAuthTokens({ token: accessToken, accessToken, refreshToken: refreshToken ?? undefined });
    router.replace(mustChangePassword ? "/change-password-first" : "/");
  }, [router, searchParams]);

  useEffect(() => {
    if (!forgotOpen || forgotCooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setForgotCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [forgotCooldown, forgotOpen]);

  // validate dữ liệu nhập
  const validate = () => {
    if (!email || !password) return "Vui lòng nhập đầy đủ thông tin";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Email không hợp lệ";

    if (password.length < 6) return "Mật khẩu tối thiểu 6 ký tự";

    return "";
  };

  // xử lý login
  const handleLogin = async () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await api<LoginResponse>("/users/login", "POST", {
        email,
        password,
      });

      // kiểm tra token
      if (!res?.token) {
        setError("Sai email hoặc mật khẩu");
        return;
      }

      // decode token để kiểm tra role
      const accessToken = res.accessToken ?? res.token;
      const payload = JSON.parse(atob(accessToken.split(".")[1]));

      if (payload.role !== "ADMIN") {
        setError("Sai email hoặc mật khẩu");
        return;
      }

      // lưu token
      saveAuthTokens(res);

      if (res.mustChangePassword) {
        router.push("/change-password-first");
        return;
      }

      // chuyển trang
      router.push("/");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Không thể kết nối hệ thống";

      setError(
        message.toLowerCase().includes("fetch") ||
          message.toLowerCase().includes("network")
          ? "Không thể kết nối hệ thống. Vui lòng kiểm tra mạng hoặc thử lại sau."
          : message || "Sai email hoặc mật khẩu"
      );
    } finally {
      setLoading(false);
    }
  };

  // login google
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const resetForgotFlow = (nextEmail = "") => {
    setForgotStep("EMAIL");
    setForgotEmail(nextEmail);
    setForgotOtp("");
    setForgotResetToken("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotCooldown(0);
    setForgotError("");
    setForgotMessage("");
  };

  const openForgotFlow = () => {
    resetForgotFlow(email.trim().toLowerCase());
    setForgotOpen(true);
  };

  const closeForgotFlow = () => {
    setForgotOpen(false);
    resetForgotFlow();
  };

  const requestForgotOtp = async (isResend = false) => {
    const nextEmail = forgotEmail.trim().toLowerCase();

    if (!nextEmail) {
      setForgotError("Vui lòng nhập email.");
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError("");
      setForgotMessage("");
      const response = await api<{ message: string }>(
        "/users/forgot-password",
        "POST",
        { email: nextEmail }
      );
      setForgotEmail(nextEmail);
      setForgotOtp("");
      setForgotResetToken("");
      setForgotStep("OTP");
      setForgotCooldown(RESEND_COOLDOWN_SECONDS);
      setForgotMessage(isResend ? "Đã gửi lại mã OTP." : response.message);
    } catch (caughtError) {
      setForgotError(
        caughtError instanceof Error ? caughtError.message : "Không thể gửi mã xác nhận."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    if (!forgotOtp.trim()) {
      setForgotError("Vui lòng nhập mã OTP.");
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError("");
      setForgotMessage("");
      const response = await api<{ message: string; reset_token: string }>(
        "/users/verify-reset-otp",
        "POST",
        { email: forgotEmail, otp: forgotOtp.trim() }
      );
      setForgotResetToken(response.reset_token);
      setForgotStep("PASSWORD");
      setForgotMessage(response.message || "Xác thực mã thành công.");
    } catch (caughtError) {
      setForgotError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mã OTP không hợp lệ hoặc đã hết hạn."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!forgotNewPassword || !forgotConfirmPassword) {
      setForgotError("Vui lòng nhập mật khẩu mới và xác nhận mật khẩu.");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError("");
      setForgotMessage("");
      const response = await api<ResetPasswordResponse>("/users/reset-password", "POST", {
        reset_token: forgotResetToken,
        new_password: forgotNewPassword,
        confirm_password: forgotConfirmPassword,
      });
      const accessToken = response.accessToken ?? response.token;

      setForgotMessage(response.message || "Đặt lại mật khẩu thành công.");

      if (getJwtRole(accessToken) === "ADMIN") {
        saveAuthTokens(response);
        router.replace(response.mustChangePassword ? "/change-password-first" : "/");
        return;
      }

      setTimeout(() => {
        closeForgotFlow();
        setError("Mật khẩu đã được đổi. Vui lòng đăng nhập bằng tài khoản admin.");
      }, 1200);
    } catch (caughtError) {
      setForgotError(
        caughtError instanceof Error ? caughtError.message : "Không thể đặt lại mật khẩu."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const forgotTitle =
    forgotStep === "EMAIL"
      ? "Quên mật khẩu"
      : forgotStep === "OTP"
        ? "Nhập mã OTP"
        : "Tạo mật khẩu mới";
  const forgotCaption =
    forgotStep === "EMAIL"
      ? "Nhập email tài khoản. Hệ thống sẽ gửi mã OTP về email đó."
      : forgotStep === "OTP"
        ? `Mã OTP đã được gửi đến ${forgotEmail}.`
        : "Nhập mật khẩu mới để hoàn tất đặt lại mật khẩu.";

  return (
    // background full màn hình
    <div className="min-h-screen w-full bg-gradient-to-br from-orange-500 via-orange-300 to-white">

      {/* layer để căn giữa container */}
      <div className="min-h-screen flex items-center justify-center px-4">

        {/* container lớn */}
        <div className="w-full max-w-6xl rounded-3xl bg-white/20 backdrop-blur-xl p-4 shadow-2xl">

          {/* layout bên trong */}
          <div className="flex rounded-2xl overflow-hidden bg-white">

            {/* LEFT */}
            <div className="hidden md:flex w-1/2 bg-orange-500 text-white flex-col items-center justify-center px-12 py-16 text-center">

              <h1 className="text-5xl font-bold mb-4">
                Tiêu gì
              </h1>

              <p className="text-white/90 mb-10 text-lg max-w-md">
                Quản lý chi tiêu thông minh. Tiêu gì cũng biết.
              </p>

              <Image
                src="/finance.png"
                alt="Minh hoa quan ly tai chinh"
                width={384}
                height={210}
                priority
                className="drop-shadow-2xl"
                style={{ width: 320, height: "auto" }}
              />
            </div>

            {/* RIGHT */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-10 bg-[#f8f9fa]">

              <div className="w-full max-w-md">

                <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">
                  Đăng nhập
                </h2>

                {/* input email */}
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mb-5 p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                />

                {/* input password */}
                <div className="relative mb-6">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                {/* hiển thị lỗi */}
                {error && (
                  <p className="text-red-500 text-sm mb-4">
                    {error}
                  </p>
                )}

                {/* nút login */}
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-xl font-semibold shadow-md transition disabled:opacity-50"
                >
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </button>

                <button
                  type="button"
                  onClick={openForgotFlow}
                  className="mt-3 w-full text-center text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Quên mật khẩu?
                </button>

                {/* divider */}
                <div className="flex items-center my-6">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="px-3 text-gray-400 text-sm">hoặc</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* login google */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 border border-gray-300 p-3 rounded-xl hover:bg-gray-100 transition"
                >
                  <FcGoogle size={20} />
                  Đăng nhập bằng Google
                </button>

              </div>
            </div>

          </div>
        </div>

      </div>
      {forgotOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-gray-900">{forgotTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {forgotCaption}
              </p>
            </div>

            {forgotStep === "EMAIL" ? (
              <input
                value={forgotEmail}
                onChange={(event) => {
                  setForgotEmail(event.target.value);
                  setForgotError("");
                  setForgotMessage("");
                }}
                className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                placeholder="Email"
              />
            ) : null}

            {forgotStep === "OTP" ? (
              <div className="space-y-3">
                <input
                  value={forgotOtp}
                  onChange={(event) => {
                    setForgotOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setForgotError("");
                    setForgotMessage("");
                  }}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-center text-xl font-bold tracking-normal outline-none transition focus:border-orange-400"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Mã OTP"
                />
                <button
                  type="button"
                  onClick={() => requestForgotOtp(true)}
                  disabled={forgotLoading || forgotCooldown > 0}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-orange-600 transition hover:bg-orange-50 disabled:opacity-60"
                >
                  {forgotCooldown > 0 ? `Gửi lại sau ${forgotCooldown}s` : "Gửi lại mã"}
                </button>
              </div>
            ) : null}

            {forgotStep === "PASSWORD" ? (
              <div className="space-y-3">
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(event) => {
                    setForgotNewPassword(event.target.value);
                    setForgotError("");
                    setForgotMessage("");
                  }}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                  placeholder="Mật khẩu mới"
                />
                <input
                  type="password"
                  value={forgotConfirmPassword}
                  onChange={(event) => {
                    setForgotConfirmPassword(event.target.value);
                    setForgotError("");
                    setForgotMessage("");
                  }}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                  placeholder="Xác nhận mật khẩu"
                />
              </div>
            ) : null}

            {forgotError ? <p className="mt-3 text-sm text-red-600">{forgotError}</p> : null}
            {forgotMessage ? <p className="mt-3 text-sm text-emerald-700">{forgotMessage}</p> : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeForgotFlow}
                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={
                  forgotStep === "EMAIL"
                    ? () => requestForgotOtp()
                    : forgotStep === "OTP"
                      ? verifyForgotOtp
                      : submitForgotPassword
                }
                disabled={forgotLoading}
                className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {forgotLoading
                  ? "Đang xử lý..."
                  : forgotStep === "EMAIL"
                    ? "Gửi mã"
                    : forgotStep === "OTP"
                      ? "Xác nhận"
                      : "Đổi mật khẩu"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-gradient-to-br from-orange-500 via-orange-300 to-white" />
      }
    >
      <LoginContent />
    </Suspense>
  );
}
