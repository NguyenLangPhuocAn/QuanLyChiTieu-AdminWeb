"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

type AdminLog = {
  id: number;
  admin_id?: number | null;
  action?: string | null;
  created_at?: string | null;
};

type PaginatedResponse<T> = {
  data: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ActionFilter = "ALL" | "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "UPLOAD";
type TargetFilter = "ALL" | "USER" | "CATEGORY" | "NOTIFICATION";
type TimeSortOption = "TIME_DESC" | "TIME_ASC";
const PAGE_SIZE = 10;

function formatDate(value?: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [sortOption, setSortOption] = useState<TimeSortOption>("TIME_DESC");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const loadLogs = useCallback(async (
    overrides: Partial<{
      page: number;
      actionFilter: ActionFilter;
      targetFilter: TargetFilter;
      dateFilter: string;
      sortOption: TimeSortOption;
    }> = {}
  ) => {
    try {
      setError("");
      const nextPage = overrides.page ?? page;
      const nextActionFilter = overrides.actionFilter ?? actionFilter;
      const nextTargetFilter = overrides.targetFilter ?? targetFilter;
      const nextDateFilter = overrides.dateFilter ?? dateFilter;
      const nextSortOption = overrides.sortOption ?? sortOption;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        sort: nextSortOption === "TIME_ASC" ? "time_asc" : "time_desc",
      });

      if (nextActionFilter !== "ALL") {
        params.set("action", nextActionFilter);
      }

      if (nextTargetFilter !== "ALL") {
        params.set("target", nextTargetFilter);
      }

      if (nextDateFilter) {
        params.set("date", nextDateFilter);
      }

      const response = await api<AdminLog[] | PaginatedResponse<AdminLog>>(
        `/admin/logs?${params.toString()}`
      );
      const nextLogs = Array.isArray(response) ? response : response.data;
      setLogs(nextLogs);
      setPagination(
        Array.isArray(response)
          ? { total: nextLogs.length, totalPages: Math.max(Math.ceil(nextLogs.length / PAGE_SIZE), 1) }
          : {
              total: response.meta?.total ?? nextLogs.length,
              totalPages: response.meta?.totalPages ?? 1,
            }
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tải logs hệ thống."
      );
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFilter, page, sortOption, targetFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const resetAndReload = async () => {
    setActionFilter("ALL");
    setTargetFilter("ALL");
    setDateFilter("");
    setSortOption("TIME_DESC");
    setPage(1);
    setLoading(true);
    await loadLogs({
      page: 1,
      actionFilter: "ALL",
      targetFilter: "ALL",
      dateFilter: "",
      sortOption: "TIME_DESC",
    });
  };

  const toggleTimeSort = () => {
    setPage(1);
    setSortOption((current) => (current === "TIME_DESC" ? "TIME_ASC" : "TIME_DESC"));
  };

  const timeSortDirection = sortOption === "TIME_ASC" ? "ASC" : "DESC";

  const sortedLogs = logs;
  const totalPages = pagination.totalPages;
  const paginatedLogs = logs;
  const safePage = Math.min(page, totalPages);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void resetAndReload()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-200 bg-white transition hover:bg-orange-50 disabled:cursor-not-allowed"
            disabled={loading}
            aria-label="Tải lại dữ liệu"
          >
            <span
              className={[
                "h-5 w-5 rounded-full border-2 border-orange-300 border-t-orange-600",
                loading ? "animate-spin" : "",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-600">Đang tải logs...</div>
        ) : error ? (
          <div className="px-6 py-10 text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-orange-50 text-sm uppercase tracking-wide text-orange-700">
                <tr>
                  <th className="border-b-2 border-orange-200 px-6 py-4 font-semibold">ID</th>
                  <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">User</th>
                  <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">
                    <div className="space-y-2">
                      <span>Hành động</span>
                      <div className="flex gap-2">
                        <select
                          value={actionFilter}
                          onChange={(event) => {
                            setActionFilter(event.target.value as ActionFilter);
                            setPage(1);
                          }}
                          className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs normal-case text-slate-700 outline-none"
                        >
                          <option value="ALL">Tất cả</option>
                          <option value="CREATE">Thêm/Tạo</option>
                          <option value="UPDATE">Cập nhật/Sửa</option>
                          <option value="DELETE">Xóa</option>
                          <option value="LOGIN">Đăng nhập</option>
                          <option value="LOGOUT">Đăng xuất</option>
                          <option value="UPLOAD">Upload</option>
                        </select>

                        <select
                          value={targetFilter}
                          onChange={(event) => {
                            setTargetFilter(event.target.value as TargetFilter);
                            setPage(1);
                          }}
                          className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs normal-case text-slate-700 outline-none"
                        >
                          <option value="ALL">Tất cả mục</option>
                          <option value="USER">Người dùng</option>
                          <option value="CATEGORY">Danh mục</option>
                          <option value="NOTIFICATION">Thông báo</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span>Thời gian</span>
                        <button
                          type="button"
                          onClick={toggleTimeSort}
                          className="flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold normal-case text-orange-700"
                        >
                          <span className={timeSortDirection === "ASC" ? "text-orange-700" : "text-slate-300"}>↑</span>
                          <span className={timeSortDirection === "DESC" ? "text-orange-700" : "text-slate-300"}>↓</span>
                        </button>
                      </div>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(event) => {
                          setDateFilter(event.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs normal-case text-slate-700 outline-none"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.length === 0 ? (
                  <tr className="border-t border-orange-200 text-sm text-slate-700">
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-600">
                      Không có logs phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="border-t border-orange-200 text-sm text-slate-700">
                      <td className="px-6 py-4 font-semibold text-slate-900">{log.id}</td>
                      <td className="px-6 py-4">{log.admin_id ?? "--"}</td>
                      <td className="px-6 py-4">{log.action || "--"}</td>
                      <td className="px-6 py-4">{formatDate(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pagination.total > PAGE_SIZE ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 px-6 py-4 text-sm">
                <span className="font-medium text-slate-600">
                  Trang {safePage}/{totalPages} · {pagination.total} logs
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={safePage === 1}
                    className="rounded-xl border border-orange-200 px-4 py-2 font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    disabled={safePage === totalPages}
                    className="rounded-xl border border-orange-200 px-4 py-2 font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
