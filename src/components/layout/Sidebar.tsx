"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, clearAuthTokens } from "@/services/api";

const menuItems = [
  {
    label: "Tổng quan",
    href: "/",
    description: "Theo dõi nhanh tình hình hệ thống",
  },
  {
    label: "Người dùng",
    href: "/users",
    description: "Quản lý tài khoản",
  },
  {
    label: "Hồ sơ admin",
    href: "/admin-profile",
    description: "Thông tin tài khoản của tôi",
  },
  {
    label: "Danh mục",
    href: "/categories",
    description: "Quản lý danh mục",
  },
  {
    label: "Thống kê",
    href: "/statistics",
    description: "Phân tích hệ thống",
  },
  {
    label: "Logs",
    href: "/logs",
    description: "Theo dõi hoạt động hệ thống",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");

    try {
      await api("/users/logout", "POST", { refreshToken });
    } catch {
      // Vẫn cho đăng xuất ở client nếu backend không phản hồi.
    }

    clearAuthTokens();
    router.replace("/login");
  };

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-72 flex-col border-r border-orange-200 bg-gradient-to-b from-orange-600 via-orange-500 to-amber-500 text-orange-50">
      <div className="border-b border-orange-400/40 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-100">
          Expense Admin
        </p>
        <h1 className="mt-3 text-2xl font-bold text-white">
          Quản lý chi tiêu
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "block rounded-2xl border px-4 py-3 transition",
                    isActive
                      ? "border-white/60 bg-white text-orange-700 shadow-lg"
                      : "border-transparent bg-orange-700/20 text-orange-50 hover:border-white/20 hover:bg-orange-700/30 hover:text-white",
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-inherit opacity-80">
                    {item.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-orange-400/40 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-2xl border border-white/30 bg-orange-700/25 px-4 py-3 text-left text-sm font-semibold text-orange-50 transition hover:border-white/50 hover:bg-white hover:text-orange-700"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
