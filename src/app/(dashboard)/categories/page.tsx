"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { API_URL, api, apiUploadFile } from "@/services/api";

type CategoryType = "INCOME" | "EXPENSE";
type ModalMode = "create" | "edit" | "delete" | null;

type CategoryItem = {
  id: number;
  name: string;
  type: CategoryType;
  icon?: string | null;
  is_system?: boolean | null;
  user_id?: number | null;
};

type CategoryFormState = {
  name: string;
  type: CategoryType;
  is_system: boolean;
};

const defaultFormState: CategoryFormState = {
  name: "",
  type: "EXPENSE",
  is_system: false,
};

const typeOptions: CategoryType[] = ["EXPENSE", "INCOME"];
type CategorySortOption = "NAME_ASC" | "NAME_DESC";

function getTypeLabel(type: CategoryType) {
  return type === "INCOME" ? "Thu nhập" : "Chi tiêu";
}

function getTypeClasses(type: CategoryType) {
  if (type === "INCOME") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border border-rose-200 bg-rose-50 text-rose-700";
}

function getScopeLabel(category: CategoryItem) {
  return category.is_system ? "Hệ thống" : "Cá nhân";
}

function getScopeClasses(category: CategoryItem) {
  if (category.is_system) {
    return "border border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  return "border border-orange-200 bg-orange-50 text-orange-700";
}

function resolveIconSrc(icon?: string | null) {
  if (!icon) {
    return "";
  }

  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return icon;
  }

  if (icon.startsWith("categories/icons/")) {
    return `${API_URL}/public/${icon}`;
  }

  return `${API_URL}/uploads/categories/${icon}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function getModalTitle(mode: Exclude<ModalMode, null>) {
  if (mode === "create") {
    return "Thêm danh mục";
  }

  if (mode === "edit") {
    return "Sửa danh mục";
  }

  return "Xóa danh mục";
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | CategoryType>("ALL");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "SYSTEM" | "PERSONAL">("ALL");
  const [sortOption, setSortOption] = useState<CategorySortOption>("NAME_ASC");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(defaultFormState);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const loadCategories = async () => {
    try {
      setError("");
      const data = await api<CategoryItem[]>("/categories");
      setCategories(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể tải danh sách danh mục."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const fetchCategories = async () => {
    setSearchText("");
    setTypeFilter("ALL");
    setScopeFilter("ALL");
    setSortOption("NAME_ASC");
    setLoading(true);
    await loadCategories();
  };

  const toggleNameSort = () => {
    setSortOption((current) => (current === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC"));
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedCategory(null);
    setFormState(defaultFormState);
    setIconFile(null);
    setModalError("");
    setSubmitting(false);
    setShowEditConfirm(false);
  };

  const openCreateModal = () => {
    setSelectedCategory(null);
    setFormState(defaultFormState);
    setIconFile(null);
    setModalError("");
    setShowEditConfirm(false);
    setModalMode("create");
  };

  const openEditModal = (category: CategoryItem) => {
    setSelectedCategory(category);
    setFormState({
      name: category.name ?? "",
      type: category.type ?? "EXPENSE",
      is_system: Boolean(category.is_system),
    });
    setIconFile(null);
    setModalError("");
    setShowEditConfirm(false);
    setModalMode("edit");
  };

  const openDeleteModal = (category: CategoryItem) => {
    setSelectedCategory(category);
    setModalError("");
    setShowEditConfirm(false);
    setModalMode("delete");
  };

  const updateField = <K extends keyof CategoryFormState>(
    field: K,
    value: CategoryFormState[K]
  ) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formState.name.trim()) {
      setModalError("Tên danh mục không được để trống.");
      return false;
    }

    if (formState.name.trim().length > 50) {
      setModalError("Tên danh mục tối đa 50 ký tự.");
      return false;
    }

    setModalError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      const createdCategory = await api<CategoryItem>("/categories", "POST", {
        name: formState.name.trim(),
        type: formState.type,
        is_system: formState.is_system,
      });

      if (iconFile) {
        await apiUploadFile(
          `/categories/${createdCategory.id}/icon`,
          iconFile,
          "file",
          "POST"
        );
      }

      await fetchCategories();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể thêm danh mục."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestEditConfirmation = () => {
    if (!validateForm()) {
      return;
    }

    if (!selectedCategory?.id) {
      setModalError("Không tìm thấy danh mục cần cập nhật.");
      return;
    }

    setShowEditConfirm(true);
  };

  const handleEdit = async () => {
    if (!selectedCategory?.id) {
      setModalError("Không tìm thấy danh mục cần cập nhật.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setShowEditConfirm(false);

      await api(`/categories/${selectedCategory.id}`, "PUT", {
        name: formState.name.trim(),
        type: formState.type,
      });

      if (iconFile) {
        await apiUploadFile(
          `/categories/${selectedCategory.id}/icon`,
          iconFile,
          "file",
          "POST"
        );
      }

      await fetchCategories();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể cập nhật danh mục."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory?.id) {
      setModalError("Không tìm thấy danh mục để xóa.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      await api(`/categories/${selectedCategory.id}`, "DELETE");
      await fetchCategories();
      closeModal();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Xóa danh mục thất bại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCategories = categories.filter((category) => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const matchedName = normalizedSearch
      ? category.name.toLowerCase().includes(normalizedSearch)
      : true;
    const matchedType = typeFilter === "ALL" ? true : category.type === typeFilter;
    const matchedScope =
      scopeFilter === "ALL"
        ? true
        : scopeFilter === "SYSTEM"
          ? Boolean(category.is_system)
          : !category.is_system;

    return matchedName && matchedType && matchedScope;
  });
  const sortedCategories = [...filteredCategories].sort((left, right) => {
    const result = left.name.localeCompare(right.name, "vi");

    return sortOption === "NAME_ASC" ? result : -result;
  });

  const renderIcon = (category: Pick<CategoryItem, "icon" | "name">) => {
    const src = resolveIconSrc(category.icon);

    if (src) {
      return (
        <img
          src={src}
          alt={category.name}
          className="h-12 w-12 rounded-2xl object-cover"
        />
      );
    }

    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-sm font-bold text-orange-700">
        {getInitials(category.name)}
      </div>
    );
  };

  const renderPreviewIcon = () => {
    if (iconFile) {
      return (
        <img
          src={URL.createObjectURL(iconFile)}
          alt={formState.name || "Icon preview"}
          className="h-16 w-16 rounded-2xl object-cover"
        />
      );
    }

    if (selectedCategory) {
      return renderIcon(selectedCategory);
    }

    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-sm font-bold text-orange-700">
        {formState.name ? getInitials(formState.name) : "DM"}
      </div>
    );
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
                  Bạn có chắc muốn xóa danh mục{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedCategory?.name}
                  </span>{" "}
                  không?
                </p>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-slate-600">
                  Danh mục hệ thống hoặc danh mục không thuộc quyền của bạn sẽ bị
                  backend từ chối xóa.
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
                    onClick={handleDelete}
                    disabled={submitting}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Đang xóa..." : "Xóa danh mục"}
                  </button>
                </div>
              </div>
            ) : (
          <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Tên danh mục
                    </span>
                    <input
                      value={formState.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      maxLength={50}
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                      placeholder="Ví dụ: Ăn uống"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Loại</span>
                    <select
                      value={formState.type}
                      onChange={(event) =>
                        updateField("type", event.target.value as CategoryType)
                      }
                      className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                    >
                      {typeOptions.map((type) => (
                        <option key={type} value={type}>
                          {getTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {modalMode === "create" ? (
                    <label className="flex items-center gap-3 rounded-2xl border border-orange-100 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={formState.is_system}
                        onChange={(event) =>
                          updateField("is_system", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-orange-300 text-orange-500"
                      />
                      Tạo danh mục hệ thống
                    </label>
                  ) : null}

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Upload icon
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(event) => setIconFile(event.target.files?.[0] ?? null)}
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Xem trước icon
                  </p>
                  {renderPreviewIcon()}
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
                      modalMode === "create" ? handleCreate : requestEditConfirmation
                    }
                    disabled={submitting}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Đang xử lý..."
                      : modalMode === "create"
                        ? "Thêm danh mục"
                        : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            )}
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
                    Bạn có chắc muốn lưu thay đổi cho danh mục{" "}
                    <span className="font-semibold text-slate-900">
                      {formState.name || selectedCategory?.name}
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
      </div>
    );
  };

  return (
    <>
      <section className="space-y-6">
        <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 lg:flex-row">
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-400 lg:max-w-sm"
                  placeholder="Tìm theo tên danh mục"
                />

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as "ALL" | CategoryType)
                  }
                  className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                >
                  <option value="ALL">Tất cả</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {getTypeLabel(type)}
                    </option>
                  ))}
                </select>

                <select
                  value={scopeFilter}
                  onChange={(event) =>
                    setScopeFilter(
                      event.target.value as "ALL" | "SYSTEM" | "PERSONAL"
                    )
                  }
                  className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="SYSTEM">Hệ thống</option>
                  <option value="PERSONAL">Cá nhân</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchCategories}
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
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  + Thêm danh mục
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-600">
              Đang tải danh sách danh mục...
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-red-600">{error}</div>
          ) : sortedCategories.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-600">
              Không có danh mục phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-orange-50 text-sm uppercase tracking-wide text-orange-700">
                  <tr>
                    <th className="border-b-2 border-orange-200 px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Danh mục</span>
                        <button
                          type="button"
                          onClick={toggleNameSort}
                          className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold normal-case text-orange-700"
                        >
                          {sortOption === "NAME_ASC" ? "A-Z" : "Z-A"}
                        </button>
                      </div>
                    </th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">Loại</th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold">Phạm vi</th>
                    <th className="border-b-2 border-orange-200 border-l border-orange-200 px-6 py-4 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedCategories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-t border-orange-200 text-sm text-slate-700"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {renderIcon(category)}
                          <div>
                            <p className="font-semibold text-slate-900">
                              {category.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              ID: {category.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getTypeClasses(category.type),
                          ].join(" ")}
                        >
                          {getTypeLabel(category.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getScopeClasses(category),
                          ].join(" ")}
                        >
                          {getScopeLabel(category)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(category)}
                            className="rounded-xl border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(category)}
                            className="rounded-xl border border-red-200 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {renderModal()}
    </>
  );
}
