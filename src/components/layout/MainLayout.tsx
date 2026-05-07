"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/services/api";

type MainLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();

  // Chỉ dùng để xác định có token hay không ở phía client.
  const [hasToken] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(localStorage.getItem("token"));
  });

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (!cancelled) {
          router.replace("/login");
        }
        return;
      }

      try {
        // Xác thực token bằng endpoint profile.
        await api("/users/me");
      } catch {
        // Token sai/hết hạn: xóa token để tránh lặp và đưa về trang login.
        localStorage.removeItem("token");

        if (!cancelled) {
          router.replace("/login");
        }
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!hasToken) {
    // Không hiển thị màn hình loading; chỉ redirect về /login.
    return null;
  }

  return (
    <div className="min-h-screen bg-orange-50 text-slate-900">
      <Sidebar />

      {/* Khu vực nội dung chính nằm bên phải sidebar cố định. */}
      <div className="ml-72 min-h-screen">
        <Header />

        <main className="min-h-[calc(100vh-89px)] px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
