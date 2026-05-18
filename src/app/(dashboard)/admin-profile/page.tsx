"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, api, apiUploadFile } from "@/services/api";
import DatePickerInput from "@/components/DatePickerInput";

type AdminProfile = {
  id: number;
  email: string;
  role: string;
  full_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  address?: string | null;
  avatar?: string | null;
  currency_default?: string | null;
};

type ProfileForm = {
  full_name: string;
  phone: string;
  birthday: string;
  address: string;
  currency_default: string;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const defaultForm: ProfileForm = {
  full_name: "",
  phone: "",
  birthday: "",
  address: "",
  currency_default: "VND",
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const currencyOptions = [
  "VND",
  "USD",
  "EUR",
  "JPY",
  "KRW",
  "CNY",
  "THB",
  "SGD",
  "AUD",
  "GBP",
  "CAD",
  "CHF",
  "HKD",
  "TWD",
  "MYR",
  "IDR",
  "PHP",
  "INR",
  "NZD",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "SEK",
  "NOK",
  "DKK",
  "MXN",
  "BRL",
  "ZAR",
  "TRY",
  "PLN",
  "CZK",
];

function formatBirthday(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function resolveAvatarSrc(avatar?: string | null) {
  if (!avatar) {
    return "";
  }

  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  return `${API_URL}/uploads/avatars/${avatar}`;
}

function getInitials(fullName?: string | null, email?: string) {
  const source = fullName?.trim() || email || "A";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function isValidPhoneNumber(phone: string) {
  if (!phone.trim()) {
    return true;
  }

  return /^0\d{9}$/.test(phone.trim());
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(defaultForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const avatarPreviewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile]
  );

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const fillForm = useCallback((nextProfile: AdminProfile) => {
    setForm((current) => ({
      ...current,
      full_name: nextProfile.full_name ?? "",
      phone: nextProfile.phone ?? "",
      birthday: formatBirthday(nextProfile.birthday),
      address: nextProfile.address ?? "",
      currency_default: nextProfile.currency_default ?? "VND",
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setError("");
      const data = await api<AdminProfile>("/users/me");
      setProfile(data);
      fillForm(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tải hồ sơ admin."
      );
    } finally {
      setLoading(false);
    }
  }, [fillForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAvatarFileChange = (file?: File | null) => {
    if (!file) {
      setAvatarFile(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 3 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      setAvatarFile(null);
      return;
    }

    if (file.size > maxSize) {
      setError("Ảnh không được vượt quá 3MB.");
      setAvatarFile(null);
      return;
    }

    setError("");
    setAvatarFile(file);
  };

  const renderAvatar = () => {
    const src = avatarPreviewUrl || resolveAvatarSrc(profile?.avatar);

    if (src) {
      return (
        <img
          src={src}
          alt={form.full_name || profile?.email || "Admin"}
          className="h-24 w-24 rounded-2xl object-cover"
        />
      );
    }

    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-orange-100 text-2xl font-bold text-orange-700">
        {getInitials(form.full_name, profile?.email)}
      </div>
    );
  };

  const handleSave = async () => {
    if (!isValidPhoneNumber(form.phone)) {
      setError("Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 số.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      let nextProfile = await api<AdminProfile>("/users/me", "PUT", {
        full_name: form.full_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        birthday: form.birthday || undefined,
        address: form.address.trim() || undefined,
        currency_default: form.currency_default || undefined,
      });

      if (avatarFile) {
        nextProfile = await apiUploadFile<AdminProfile>("/users/me/avatar", avatarFile);
      }

      setProfile(nextProfile);
      fillForm(nextProfile);
      setAvatarFile(null);
      setSuccess("Đã cập nhật hồ sơ admin.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể cập nhật hồ sơ admin."
      );
    } finally {
      setSaving(false);
    }
  };

  const openPasswordModal = () => {
    setPasswordError("");
    setForm((current) => ({
      ...current,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError("");
    setChangingPassword(false);
    setForm((current) => ({
      ...current,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
  };

  const handleChangePassword = async () => {
    if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
      setPasswordError("Vui lòng nhập đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError("");
      setSuccess("");

      await api("/users/change-password", "PUT", {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      closePasswordModal();
      setSuccess("Đã đổi mật khẩu thành công.");
    } catch (caughtError) {
      setPasswordError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể đổi mật khẩu."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-3xl border border-orange-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Đang tải hồ sơ admin...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-5">
            {renderAvatar()}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                Tài khoản admin
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {form.full_name || profile?.email || "Admin"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{profile?.email}</p>
            </div>
          </div>

          <label className="w-full space-y-2 lg:max-w-xs">
            <span className="text-sm font-medium text-slate-700">Đổi avatar</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                handleAvatarFileChange(event.target.files?.[0] ?? null)
              }
              className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
            />
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              value={profile?.email ?? ""}
              readOnly
              className="w-full cursor-not-allowed rounded-2xl border border-orange-100 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Vai trò</span>
            <input
              value={profile?.role ?? ""}
              readOnly
              className="w-full cursor-not-allowed rounded-2xl border border-orange-100 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Họ và tên</span>
            <input
              value={form.full_name}
              onChange={(event) => updateField("full_name", event.target.value)}
              className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              placeholder="Nhập họ và tên"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Số điện thoại</span>
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              placeholder="0xxxxxxxxx"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Ngày sinh</span>
            <DatePickerInput
              value={form.birthday}
              onChange={(value) => updateField("birthday", value)}
              label="Ngày sinh"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Tiền tệ mặc định</span>
            <select
              value={form.currency_default}
              onChange={(event) => updateField("currency_default", event.target.value)}
              className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Địa chỉ</span>
            <textarea
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              placeholder="Nhập địa chỉ"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={openPasswordModal}
          className="rounded-xl border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
        >
          Đổi mật khẩu
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu hồ sơ admin"}
        </button>
      </div>

      {showPasswordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-orange-100 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h2>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-xl border border-orange-100 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-orange-50"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {passwordError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {passwordError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</span>
                  <input
                    type="password"
                    value={form.oldPassword}
                    onChange={(event) => updateField("oldPassword", event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Mật khẩu mới</span>
                  <input
                    type="password"
                    value={form.newPassword}
                    onChange={(event) => updateField("newPassword", event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                    placeholder="Mật khẩu mạnh"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Xác nhận mật khẩu</span>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                    placeholder="Nhập lại mật khẩu"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {changingPassword ? "Đang đổi..." : "Lưu mật khẩu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
