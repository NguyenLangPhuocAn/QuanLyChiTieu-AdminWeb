"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Tổng quan hệ thống",
  "/users": "Quản lý người dùng",
  "/categories": "Quản lý danh mục",
  "/statistics": "Thống kê",
  "/logs": "Logs hệ thống",
};

export default function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Trang quản trị";

  return (
    <header className="sticky top-0 z-10 border-b border-orange-100 bg-white/95 backdrop-blur">
      <div className="px-8 py-5">
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
      </div>
    </header>
  );
}
