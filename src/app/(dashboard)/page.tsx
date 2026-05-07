"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { normalizeDashboard, type InsightSeverity, type NormalizedDashboard } from "@/lib/dashboard";
import { api } from "@/services/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSeverityClasses(severity: InsightSeverity) {
  if (severity === "danger") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getSeverityDotClasses(severity: InsightSeverity) {
  if (severity === "danger") {
    return "bg-red-500";
  }

  if (severity === "warning") {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

export default function DashboardPage() {
  const [data, setData] = useState<NormalizedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setError("");
        const response = await api<unknown>("/admin/dashboard");
        setData(normalizeDashboard(response));
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Không thể tải thống kê quản trị."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-600">
        Đang tải thống kê...
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-3xl bg-white p-6 text-sm text-red-600">{error}</div>;
  }

  const chartData = data.chart.length
    ? data.chart
    : [{ month: "Hiện tại", income: data.totalIncome, expense: data.totalExpense }];
  const summaryCards = [
    {
      label: "Người dùng",
      value: data.totalUsers.toLocaleString("vi-VN"),
      note: `${data.premiumUsers} tài khoản Premium · ${data.basicUsers} người dùng Basic`,
    },
    {
      label: "Ví đang quản lý",
      value: data.totalWallets.toLocaleString("vi-VN"),
      note: `${data.negativeWallets} ví âm · ${data.overBudgetWallets} ví vượt budget`,
    },
    {
      label: "Tổng thu",
      value: formatCurrency(data.totalIncome),
      note: `Tỷ lệ Premium: ${data.premiumRate}%`,
    },
    {
      label: "Tổng chi",
      value: formatCurrency(data.totalExpense),
      note: `Tổng số dư ví: ${formatCurrency(data.totalBalance)}`,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-orange-600">{card.label}</p>
            <p className="mt-4 text-3xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{card.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Thu chi</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000000}tr`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="income" name="Thu" fill="#16a34a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name="Chi" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Gợi ý đánh giá</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              Premium {data.premiumRate}%
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {data.insights.map((item) => (
              <div
                key={item.title}
                className={[
                  "rounded-2xl border px-4 py-3 text-sm leading-6",
                  getSeverityClasses(item.severity),
                ].join(" ")}
              >
                <div className="flex items-center gap-2 font-bold">
                  <span className={["h-2.5 w-2.5 rounded-full", getSeverityDotClasses(item.severity)].join(" ")} />
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6">{item.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Nhật ký admin gần đây</h2>
        <div className="mt-5 space-y-3">
          {data.recentLogs.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có nhật ký quản trị.</p>
          ) : (
            data.recentLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{log.action || "Không có nội dung"}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(log.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
