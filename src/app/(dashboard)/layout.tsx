"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";

export default function DashboardLayout({ children }: any) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
    }
  }, []);

  return (
    <div className="flex">
      <Sidebar />

      <main className="ml-64 flex-1 p-6 bg-gray-100 min-h-screen">
        {children}
      </main>
    </div>
  );
}