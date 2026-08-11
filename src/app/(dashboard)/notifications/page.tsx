"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FiSend, FiTrash2, FiX } from "react-icons/fi";
import { api } from "@/services/api";

type Severity = "INFO" | "WARNING" | "CRITICAL";

type Broadcast = {
  id: number;
  title: string;
  message: string;
  severity: Severity;
  created_at: string;
  revoked_at?: string | null;
};

type BroadcastHistoryResponse =
  | Broadcast[]
  | {
      data: Broadcast[];
    };

type CreateBroadcastResponse = {
  recipientCount?: number;
};

type RecallBroadcastResponse = {
  message: string;
  revokedCount: number;
};

type PendingBroadcast = {
  title: string;
  message: string;
  severity: Severity;
};

const severityOptions: Array<{ value: Severity; label: string }> = [
  { value: "INFO", label: "Thông tin" },
  { value: "WARNING", label: "Cảnh báo" },
  { value: "CRITICAL", label: "Quan trọng" },
];

const severityClasses: Record<Severity, string> = {
  INFO: "border-sky-200 bg-sky-50 text-sky-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
};

function getSeverityLabel(severity: Severity) {
  return severityOptions.find((option) => option.value === severity)?.label ?? severity;
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

function getPreview(value: string, maxLength = 96) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed || "--";
  }

  return `${trimmed.slice(0, maxLength - 1)}...`;
}

export default function NotificationsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("INFO");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recallingId, setRecallingId] = useState<number | null>(null);
  const [pendingBroadcast, setPendingBroadcast] = useState<PendingBroadcast | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadBroadcasts = useCallback(async () => {
    try {
      setError("");
      const response = await api<BroadcastHistoryResponse>(
        "/admin/notifications/broadcasts?page=1&limit=20",
      );
      setBroadcasts(Array.isArray(response) ? response : response.data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tải lịch sử thông báo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBroadcasts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBroadcasts]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = title.trim();
    const nextMessage = message.trim();

    setSuccessMessage("");

    if (!nextTitle || !nextMessage) {
      setFormError("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }

    const duplicate = broadcasts.some(
      (broadcast) =>
        broadcast.title.trim().toLocaleLowerCase("vi-VN") ===
          nextTitle.toLocaleLowerCase("vi-VN") &&
        broadcast.message.trim().toLocaleLowerCase("vi-VN") ===
          nextMessage.toLocaleLowerCase("vi-VN"),
    );
    if (duplicate) {
      setFormError("Thông báo có cùng tiêu đề và nội dung đã tồn tại.");
      return;
    }

    setFormError("");
    setPendingBroadcast({
      title: nextTitle,
      message: nextMessage,
      severity,
    });
  };

  const sendBroadcast = async (payload: PendingBroadcast) => {
    try {
      setSubmitting(true);
      setFormError("");
      const response = await api<CreateBroadcastResponse>(
        "/admin/notifications/broadcasts",
        "POST",
        payload,
      );
      setTitle("");
      setMessage("");
      setSeverity("INFO");
      setPendingBroadcast(null);
      setSuccessMessage(
        `Đã gửi thông báo đến ${response.recipientCount ?? 0} người nhận.`,
      );
      setLoading(true);
      await loadBroadcasts();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể gửi thông báo hệ thống.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecall = async (broadcast: Broadcast) => {
    const confirmed = window.confirm(
      `Thu hồi thông báo "${broadcast.title}"? Người dùng sẽ không còn thấy thông báo này trong ứng dụng.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setRecallingId(broadcast.id);
      setSuccessMessage("");
      const response = await api<RecallBroadcastResponse>(
        `/admin/notifications/broadcasts/${broadcast.id}`,
        "DELETE",
      );
      setSuccessMessage(
        `${response.message} Đã ẩn khỏi ${response.revokedCount} người nhận.`,
      );
      setLoading(true);
      await loadBroadcasts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể thu hồi thông báo.",
      );
    } finally {
      setRecallingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)]">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm"
        >
          <div>
            <p className="text-sm font-medium text-orange-600">Thông báo hệ thống</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Gửi thông báo
            </h2>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Tiêu đề
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Nhập tiêu đề thông báo"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Nội dung
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Nhập nội dung gửi đến người dùng"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Mức độ
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as Severity)}
                className="mt-2 h-12 w-full rounded-2xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError ? (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSend />
            {submitting ? "Đang gửi..." : "Gửi thông báo"}
          </button>
        </form>

        <section className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 px-6 py-5">
            <div>
              <p className="text-sm font-medium text-orange-600">Lịch sử</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Thông báo gần đây
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadBroadcasts();
              }}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-200 bg-white transition hover:bg-orange-50 disabled:cursor-not-allowed"
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

          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-600">
              Đang tải lịch sử thông báo...
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-orange-50 text-sm uppercase tracking-wide text-orange-700">
                  <tr>
                    <th className="border-b-2 border-orange-200 px-6 py-4 font-semibold">
                      Nội dung
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 text-center font-semibold">
                      Mức độ
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">
                      Ngày tạo
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 text-center font-semibold">
                      Trạng thái
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 text-center font-semibold">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.length === 0 ? (
                    <tr className="border-t border-orange-200 text-sm text-slate-700">
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-600">
                        Chưa có thông báo hệ thống.
                      </td>
                    </tr>
                  ) : (
                    broadcasts.map((broadcast) => (
                      <tr
                        key={broadcast.id}
                        className="border-t border-orange-200 text-sm text-slate-700"
                      >
                        <td className="min-w-72 px-6 py-4">
                          <p className="font-semibold text-slate-900">
                            {getPreview(broadcast.title, 72)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {getPreview(broadcast.message)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={[
                              "inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-xs font-bold",
                              severityClasses[broadcast.severity],
                            ].join(" ")}
                          >
                            {getSeverityLabel(broadcast.severity)}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatDate(broadcast.created_at)}</td>
                        <td className="px-6 py-4 text-center">
                          {broadcast.revoked_at ? (
                            <span className="inline-flex min-w-20 justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                              Đã thu hồi
                            </span>
                          ) : (
                            <span className="inline-flex min-w-20 justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Đã gửi
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => void handleRecall(broadcast)}
                            disabled={Boolean(broadcast.revoked_at) || recallingId === broadcast.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FiTrash2 />
                            {recallingId === broadcast.id ? "Đang thu hồi..." : "Thu hồi"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {pendingBroadcast ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-orange-600">Xác nhận</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Gửi thông báo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingBroadcast(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <p>
                Thông báo sẽ được gửi đến người dùng đang hoạt động và đang bật thông báo hệ
                thống. Tài khoản tạo sau thời điểm gửi sẽ không nhận thông báo này.
              </p>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="font-bold text-slate-900">{pendingBroadcast.title}</p>
                <p className="mt-2 text-slate-700">{pendingBroadcast.message}</p>
                <span
                  className={[
                    "mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                    severityClasses[pendingBroadcast.severity],
                  ].join(" ")}
                >
                  {getSeverityLabel(pendingBroadcast.severity)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingBroadcast(null)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void sendBroadcast(pendingBroadcast)}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSend />
                {submitting ? "Đang gửi..." : "Xác nhận gửi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
