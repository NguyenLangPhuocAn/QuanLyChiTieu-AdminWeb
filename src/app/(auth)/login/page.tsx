"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { api, clearAuthTokens, saveAuthTokens } from "../../../services/api";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

type LoginResponse = {
  token: string;
  accessToken?: string;
  refreshToken?: string;
};

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

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    const checkToken = async () => {
      try {
        await api("/users/me");
        router.replace("/");
      } catch {
        clearAuthTokens();
      }
    };

    void checkToken();
  }, [router]);

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

      // chuyển trang
      router.push("/");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Không thể kết nối server";

      setError(
        message.toLowerCase().includes("fetch") ||
          message.toLowerCase().includes("network")
          ? "Không thể kết nối server"
          : message || "Sai email hoặc mật khẩu"
      );
    } finally {
      setLoading(false);
    }
  };

  // login google
  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:3000/auth/google";
  };

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
                width={320}
                height={320}
                className="w-[320px] drop-shadow-2xl"
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
