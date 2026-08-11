"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, api, apiUploadFile } from "@/services/api";
import DatePickerInput from "@/components/DatePickerInput";

type UserListItem = {
  id: number;
  email: string;
  role: string;
  wallet_count?: number;
  full_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  address?: string | null;
  avatar?: string | null;
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

type ModalMode = "create" | "edit" | "delete" | null;

type UserFormState = {
  id?: number;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  full_name: string;
  phone: string;
  birthday: string;
  address: string;
};

const defaultFormState: UserFormState = {
  email: "",
  password: "",
  confirmPassword: "",
  role: "BASIC",
  full_name: "",
  phone: "",
  birthday: "",
  address: "",
};

const roleOptions = ["BASIC", "PREMIUM", "ADMIN"] as const;
const SUPER_ADMIN_EMAIL = "admin@gmail.com";
const PAGE_SIZE = 10;
const sortQueryMap: Record<UserSortOption, string> = {
  NAME_ASC: "name_asc",
  NAME_DESC: "name_desc",
  BIRTH_ASC: "birth_asc",
  BIRTH_DESC: "birth_desc",
  WALLET_ASC: "wallet_asc",
  WALLET_DESC: "wallet_desc",
};
type UserSortOption =
  | "NAME_ASC"
  | "NAME_DESC"
  | "BIRTH_ASC"
  | "BIRTH_DESC"
  | "WALLET_ASC"
  | "WALLET_DESC";

function formatBirthday(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(value);
  }

  return new Date(year, month - 1, day);
}

function formatDateDisplay(value?: string | null) {
  if (!value) {
    return "--";
  }

  const date = parseLocalDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN").format(date);
}

function isValidPhoneNumber(phone: string) {
  if (!phone.trim()) {
    return true;
  }

  return /^0\d{9}$/.test(phone.trim());
}

function buildUpdatePayload(form: UserFormState) {
  return {
    role: form.role,
    full_name: form.full_name.trim() || undefined,
    phone: form.phone.trim() || undefined,
    birthday: form.birthday || undefined,
    address: form.address.trim() || undefined,
    ...(form.password ? { password: form.password } : {}),
  };
}

function getModalTitle(mode: Exclude<ModalMode, null>) {
  if (mode === "create") {
    return "Thêm người dùng";
  }

  if (mode === "edit") {
    return "Sửa người dùng";
  }

  return "Xóa người dùng";
}

function resolveAvatarSrc(avatar?: string | null) {
  if (!avatar) {
    return "";
  }

  // Nếu backend đã trả về URL đầy đủ thì dùng trực tiếp, không ghép thêm path local.
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  // Avatar user hiện được backend lưu trong thư mục uploads/avatars.
  return `${API_URL}/uploads/avatars/${avatar}`;
}

function getInitials(fullName?: string | null, email?: string) {
  const source = fullName?.trim() || email || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getRoleClasses(role: string) {
  if (role === "ADMIN") {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (role === "PREMIUM") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border border-slate-200 bg-white text-slate-700";
}

function exportUsersToCsv(users: UserListItem[]) {
  const rows = [
    ["Tên", "Email", "Số điện thoại", "Ngày sinh", "Vai trò", "Số ví", "Địa chỉ"],
    ...users.map((user) => [
      user.full_name ?? "",
      user.email ?? "",
      user.phone ?? "",
      formatDateDisplay(user.birthday),
      user.role ?? "",
      String(user.wallet_count ?? 0),
      user.address ?? "",
    ]),
  ];

  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "danh-sach-nguoi-dung.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function UsersPage() {
  // Dữ liệu danh sách và trạng thái lọc của màn hình người dùng.
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState<UserSortOption>("NAME_ASC");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // State phục vụ popup CRUD.
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formState, setFormState] = useState<UserFormState>(defaultFormState);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
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

  const loadUsers = useCallback(async (
    overrides: Partial<{
      page: number;
      searchText: string;
      roleFilter: string;
      sortOption: UserSortOption;
    }> = {}
  ) => {
    try {
      setError("");
      const nextPage = overrides.page ?? page;
      const nextSearchText = overrides.searchText ?? searchText;
      const nextRoleFilter = overrides.roleFilter ?? roleFilter;
      const nextSortOption = overrides.sortOption ?? sortOption;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        sort: sortQueryMap[nextSortOption],
      });

      if (nextSearchText.trim()) {
        params.set("keyword", nextSearchText.trim());
      }

      if (nextRoleFilter !== "ALL") {
        params.set("role", nextRoleFilter);
      }

      const [me, data] = await Promise.all([
        api<UserListItem>("/users/me"),
        api<UserListItem[] | PaginatedResponse<UserListItem>>(`/users?${params.toString()}`),
      ]);
      setCurrentUser(me);
      const userList = Array.isArray(data) ? data : data.data;

      setUsers(userList);
      setPagination(
        Array.isArray(data)
          ? { total: userList.length, totalPages: Math.max(Math.ceil(userList.length / PAGE_SIZE), 1) }
          : {
              total: data.meta?.total ?? userList.length,
              totalPages: data.meta?.totalPages ?? 1,
            }
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tải danh sách người dùng."
      );
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, searchText, sortOption]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const fetchUsers = async () => {
    setSearchText("");
    setRoleFilter("ALL");
    setSortOption("NAME_ASC");
    setPage(1);
    setLoading(true);
    await loadUsers({
      page: 1,
      searchText: "",
      roleFilter: "ALL",
      sortOption: "NAME_ASC",
    });
  };

  const handleExportUsers = async () => {
    try {
      const limit = 100;
      const baseParams = new URLSearchParams({
        limit: String(limit),
        sort: sortQueryMap[sortOption],
      });

      if (searchText.trim()) {
        baseParams.set("keyword", searchText.trim());
      }

      if (roleFilter !== "ALL") {
        baseParams.set("role", roleFilter);
      }

      const firstParams = new URLSearchParams(baseParams);
      firstParams.set("page", "1");
      const first = await api<PaginatedResponse<UserListItem> | UserListItem[]>(
        `/users?${firstParams.toString()}`
      );
      const firstUsers = Array.isArray(first) ? first : first.data;
      const totalPages = Array.isArray(first) ? 1 : first.meta?.totalPages ?? 1;
      const allUsers = [...firstUsers];

      for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
        const params = new URLSearchParams(baseParams);
        params.set("page", String(nextPage));
        const response = await api<PaginatedResponse<UserListItem>>(
          `/users?${params.toString()}`
        );
        allUsers.push(...response.data);
      }

      exportUsersToCsv(allUsers);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể xuất danh sách người dùng."
      );
    }
  };

  const toggleSort = (field: "NAME" | "BIRTH" | "WALLET") => {
    setPage(1);
    setSortOption((current) => {
      if (field === "NAME") {
        return current === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC";
      }

      if (field === "BIRTH") {
        return current === "BIRTH_ASC" ? "BIRTH_DESC" : "BIRTH_ASC";
      }

      return current === "WALLET_ASC" ? "WALLET_DESC" : "WALLET_ASC";
    });
  };

  const getSortDirection = (field: "NAME" | "BIRTH" | "WALLET") => {
    if (field === "NAME") {
      return sortOption === "NAME_DESC" ? "DESC" : "ASC";
    }

    if (field === "BIRTH") {
      return sortOption === "BIRTH_DESC" ? "DESC" : "ASC";
    }

    return sortOption === "WALLET_DESC" ? "DESC" : "ASC";
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setModalError("");
    setSubmitting(false);
    setShowEditConfirm(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAvatarFile(null);
    setFormState(defaultFormState);
  };

  const openCreateModal = () => {
    if (currentUser?.role !== "ADMIN") {
      setError("Bạn không có quyền thêm người dùng từ trang quản trị.");
      return;
    }

    setModalError("");
    setSelectedUser(null);
    setFormState(defaultFormState);
    setModalMode("create");
  };

  const openDeleteModal = (user: UserListItem) => {
    if (!canDeleteUser(user)) {
      setError("Bạn không có quyền xóa người dùng này.");
      return;
    }

    setModalError("");
    setSelectedUser(user);
    setModalMode("delete");
  };

  const openEditModal = async (user: UserListItem) => {
    if (!canEditUser(user)) {
      setError("Bạn không có quyền sửa người dùng này.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      const detail = await api<UserListItem>(`/users/detail/${user.id}`);

      setSelectedUser(detail);
      setFormState({
        id: detail.id,
        email: detail.email ?? "",
        password: "",
        confirmPassword: "",
        role: detail.role ?? "BASIC",
        full_name: detail.full_name ?? "",
        phone: detail.phone ?? "",
        birthday: formatBirthday(detail.birthday),
        address: detail.address ?? "",
      });
      setAvatarFile(null);
      setModalMode("edit");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể lấy thông tin người dùng."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof UserFormState, value: string) => {
    setFormState((current) => ({
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
      setModalError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      setAvatarFile(null);
      return;
    }

    if (file.size > maxSize) {
      setModalError("Ảnh không được vượt quá 3MB.");
      setAvatarFile(null);
      return;
    }

    setModalError("");
    setAvatarFile(file);
  };

  const canEditUser = (user: UserListItem) => {
    if (currentUser?.id === user.id) {
      return false;
    }

    if (isSuperAdmin) {
      return true;
    }

    return user.role !== "ADMIN";
  };

  const canDeleteUser = (user: UserListItem) => {
    if (!isSuperAdmin) {
      return false;
    }

    return currentUser?.id !== user.id && user.email.toLowerCase() !== SUPER_ADMIN_EMAIL;
  };

  const canEditRole = modalMode === "create"
    ? isSuperAdmin
    : isSuperAdmin && selectedUser?.id !== currentUser?.id;

  const handleCreate = async () => {
    if (!formState.email.trim()) {
      setModalError("Vui lòng nhập email.");
      return;
    }

    if (!isValidPhoneNumber(formState.phone)) {
      setModalError("Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 số.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      const createdUser = await api<UserListItem>("/users/admin", "POST", {
        email: formState.email.trim(),
        role: formState.role,
        full_name: formState.full_name.trim() || undefined,
        phone: formState.phone.trim() || undefined,
        birthday: formState.birthday || undefined,
        address: formState.address.trim() || undefined,
      });

      if (avatarFile) {
        await apiUploadFile(`/users/detail/${createdUser.id}/avatar`, avatarFile);
      }

      await fetchUsers();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể thêm người dùng."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestEditConfirmation = () => {
    if (!selectedUser?.id) {
      setModalError("Không tìm thấy người dùng cần cập nhật.");
      return;
    }

    if (!formState.email.trim()) {
      setModalError("Email không được để trống.");
      return;
    }

    if (!isValidPhoneNumber(formState.phone)) {
      setModalError("Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 số.");
      return;
    }

    if (formState.password && formState.password !== formState.confirmPassword) {
      setModalError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setModalError("");
    setShowEditConfirm(true);
  };

  const handleEdit = async () => {
    if (!selectedUser?.id) {
      setModalError("Không tìm thấy người dùng cần cập nhật.");
      return;
    }

    if (!formState.email.trim()) {
      setModalError("Email không được để trống.");
      return;
    }

    if (!isValidPhoneNumber(formState.phone)) {
      setModalError("Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 số.");
      return;
    }

    if (formState.password && formState.password !== formState.confirmPassword) {
      setModalError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");
      setShowEditConfirm(false);

      await api(`/users/detail/${selectedUser.id}`, "PUT", buildUpdatePayload(formState));

      if (avatarFile) {
        await apiUploadFile(`/users/detail/${selectedUser.id}/avatar`, avatarFile);
      }

      await fetchUsers();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể cập nhật người dùng."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser?.id) {
      setModalError("Không tìm thấy người dùng để xóa.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      await api(`/users/detail/${selectedUser.id}`, "DELETE");
      await fetchUsers();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Xóa người dùng thất bại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sortedUsers = users;
  const totalPages = pagination.totalPages;
  const paginatedUsers = users;
  const safePage = Math.min(page, totalPages);

  const renderAvatar = (user: Pick<UserListItem, "avatar" | "full_name" | "email">) => {
    const src = resolveAvatarSrc(user.avatar);

    if (src) {
      return (
        <img
          src={src}
          alt={user.full_name || user.email}
          className="h-12 w-12 rounded-2xl object-cover"
        />
      );
    }

    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-sm font-bold text-orange-700">
        {getInitials(user.full_name, user.email)}
      </div>
    );
  };

  const renderAvatarPreview = () => {
    if (avatarPreviewUrl) {
      return (
        <img
          src={avatarPreviewUrl}
          alt={formState.full_name || formState.email}
          className="h-16 w-16 rounded-2xl object-cover"
        />
      );
    }

    return renderAvatar({
      avatar: selectedUser?.avatar,
      full_name: formState.full_name,
      email: formState.email,
    });
  };

  const renderModal = () => {
    if (!modalMode) {
      return null;
    }

    const isDeleteMode = modalMode === "delete";

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
        <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-orange-100 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">
              {getModalTitle(modalMode)}
            </h2>

            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-orange-100 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-orange-50"
            >
              Đóng
            </button>
          </div>

          <div className="px-6 py-6">
            {modalError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {modalError}
              </div>
            ) : null}

            {isDeleteMode ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  Bạn có chắc muốn xóa người dùng{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedUser?.email}
                  </span>{" "}
                  không?
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Đang xóa..." : "Xóa người dùng"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Email</span>
                    <input
                      value={formState.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      readOnly={modalMode === "edit"}
                      className={[
                        "w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400",
                        modalMode === "edit" ? "bg-slate-50 text-slate-500" : "",
                      ].join(" ")}
                      placeholder="email@example.com"
                    />
                    {modalMode === "edit" ? (
                      <span className="text-xs text-slate-500">
                        Email chỉ được xem, không thể thay đổi.
                      </span>
                    ) : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Vai trò</span>
                    <select
                      value={formState.role}
                      onChange={(event) => updateField("role", event.target.value)}
                      disabled={!canEditRole}
                      className={[
                        "w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400",
                        !canEditRole ? "cursor-not-allowed bg-slate-50 text-slate-500" : "",
                      ].join(" ")}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {!canEditRole ? (
                      <span className="text-xs text-slate-500">
                        Chỉ admin tổng được đổi role admin khác.
                      </span>
                    ) : null}
                  </label>

                  {modalMode === "edit" ? (
                    <>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">
                          Mật khẩu mới
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formState.password}
                            onChange={(event) => updateField("password", event.target.value)}
                            className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                            placeholder="Để trống nếu không đổi mật khẩu"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="shrink-0 rounded-xl border border-orange-200 px-3 py-3 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                          >
                            {showPassword ? "Ẩn" : "Hiện"}
                          </button>
                        </div>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">
                          Xác nhận mật khẩu
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={formState.confirmPassword}
                            onChange={(event) =>
                              updateField("confirmPassword", event.target.value)
                            }
                            className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                            placeholder="Nhập lại mật khẩu"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="shrink-0 rounded-xl border border-orange-200 px-3 py-3 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                          >
                            {showConfirmPassword ? "Ẩn" : "Hiện"}
                          </button>
                        </div>
                      </label>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 md:col-span-2">
                      Hệ thống sẽ tự tạo mật khẩu tạm và gửi tới email này. Người dùng phải đổi mật khẩu trong lần đăng nhập đầu tiên.
                    </div>
                  )}

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Họ và tên</span>
                    <input
                      value={formState.full_name}
                      onChange={(event) => updateField("full_name", event.target.value)}
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                      placeholder="Nhập họ và tên"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Số điện thoại</span>
                    <input
                      value={formState.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      pattern="0[0-9]{9}"
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                      placeholder="0xxxxxxxxx"
                    />
                    <span className="text-xs text-slate-500">
                      Bắt đầu bằng 0 và gồm đúng 10 số.
                    </span>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Ngày sinh</span>
                    <DatePickerInput
                      value={formState.birthday}
                      onChange={(value) => updateField("birthday", value)}
                      label="Ngày sinh"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Upload avatar
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(event) =>
                        handleAvatarFileChange(event.target.files?.[0] ?? null)
                      }
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Địa chỉ</span>
                    <textarea
                      value={formState.address}
                      onChange={(event) => updateField("address", event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                      placeholder="Nhập địa chỉ"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">Xem trước ảnh</p>
                  {renderAvatarPreview()}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={
                      modalMode === "create"
                        ? handleCreate
                        : requestEditConfirmation
                    }
                    disabled={submitting}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Đang xử lý..."
                      : modalMode === "create"
                        ? "Thêm người dùng"
                        : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {showEditConfirm && modalMode === "edit" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-orange-100 px-6 py-5">
                <h3 className="text-lg font-bold text-slate-900">
                  Xác nhận lưu thay đổi
                </h3>
              </div>

              <div className="space-y-5 px-6 py-6">
                <p className="text-sm leading-6 text-slate-600">
                  Bạn có chắc muốn lưu thay đổi cho người dùng{" "}
                  <span className="font-semibold text-slate-900">
                    {formState.email || selectedUser?.email}
                  </span>{" "}
                  không?
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditConfirm(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleEdit}
                    disabled={submitting}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <section className="space-y-6">
        <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-4 md:flex-row">
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400 md:max-w-sm"
                placeholder="Tìm theo tên người dùng"
              />

              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
              >
                <option value="ALL">Tất cả vai trò</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleExportUsers()}
                className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
              >
                Xuất Excel
              </button>

              <button
                type="button"
                onClick={fetchUsers}
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

              <button
                type="button"
                onClick={openCreateModal}
                disabled={!isSuperAdmin}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                + Thêm người dùng
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-600">
              Đang tải danh sách người dùng...
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-red-600">{error}</div>
          ) : sortedUsers.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-600">
              Không có người dùng phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-orange-50 text-sm uppercase tracking-wide text-orange-700">
                  <tr>
                    <th className="border-b-2 border-orange-200 px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Người dùng</span>
                        <button
                          type="button"
                          onClick={() => toggleSort("NAME")}
                          className="flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold normal-case text-orange-700"
                        >
                          <span className={getSortDirection("NAME") === "ASC" ? "text-orange-700" : "text-slate-300"}>↑</span>
                          <span className={getSortDirection("NAME") === "DESC" ? "text-orange-700" : "text-slate-300"}>↓</span>
                        </button>
                      </div>
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">Liên hệ</th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Ngày sinh</span>
                        <button
                          type="button"
                          onClick={() => toggleSort("BIRTH")}
                          className="flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold normal-case text-orange-700"
                        >
                          <span className={getSortDirection("BIRTH") === "ASC" ? "text-orange-700" : "text-slate-300"}>↑</span>
                          <span className={getSortDirection("BIRTH") === "DESC" ? "text-orange-700" : "text-slate-300"}>↓</span>
                        </button>
                      </div>
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">Vai trò</th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Số ví</span>
                        <button
                          type="button"
                          onClick={() => toggleSort("WALLET")}
                          className="flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold normal-case text-orange-700"
                        >
                          <span className={getSortDirection("WALLET") === "ASC" ? "text-orange-700" : "text-slate-300"}>↑</span>
                          <span className={getSortDirection("WALLET") === "DESC" ? "text-orange-700" : "text-slate-300"}>↓</span>
                        </button>
                      </div>
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedUsers.map((user) => {
                    const editable = canEditUser(user);
                    const deletable = canDeleteUser(user);

                    return (
                    <tr
                      key={user.id}
                      className="border-t border-orange-200 text-sm text-slate-700"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {renderAvatar(user)}

                          <div>
                            <p className="font-semibold text-slate-900">
                              {user.full_name || "--"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p>{user.phone || "--"}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {user.address || "--"}
                        </p>
                      </td>
                      <td className="px-6 py-4">{formatDateDisplay(user.birthday)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getRoleClasses(user.role),
                          ].join(" ")}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {user.wallet_count ?? 0}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void openEditModal(user)}
                            disabled={!editable || (submitting && selectedUser?.id === user.id)}
                            className="rounded-xl border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(user)}
                            disabled={!deletable}
                            className="rounded-xl border border-red-200 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              {pagination.total > PAGE_SIZE ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 px-6 py-4 text-sm">
                  <span className="font-medium text-slate-600">
                    Trang {safePage}/{totalPages} · {pagination.total} người dùng
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

      {renderModal()}
    </>
  );
}
