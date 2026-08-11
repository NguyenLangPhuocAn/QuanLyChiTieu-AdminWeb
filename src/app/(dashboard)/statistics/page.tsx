"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  normalizeDashboard,
  type NormalizedDashboard,
  type PeriodChartPoint,
  type PeriodKey,
} from "@/lib/dashboard";
import { api } from "@/services/api";
import DatePickerInput from "@/components/DatePickerInput";

const periodLabels: Record<PeriodKey, string> = {
  all: "Tất cả",
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
};

const pieColors = ["#16a34a", "#f97316", "#ef4444", "#0ea5e9", "#8b5cf6", "#f59e0b"];
type CategoryView = "ALL" | "INCOME" | "EXPENSE";
type PeriodOption = {
  label: string;
  value: string;
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatAxisCurrency(value: number) {
  const abs = Math.abs(value);
  const formatter = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  });

  if (abs >= 1_000_000_000) {
    return `${formatter.format(value / 1_000_000_000)} tỷ`;
  }

  if (abs >= 1_000_000) {
    return `${formatter.format(value / 1_000_000)} tr`;
  }

  if (abs >= 1_000) {
    return `${formatter.format(value / 1_000)}k`;
  }

  return formatter.format(value);
}

function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function toLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function formatDateDisplay(value: string) {
  const date = parseLocalDateValue(value);
  return `${`${date.getDate()}`.padStart(2, "0")}/${`${date.getMonth() + 1}`.padStart(2, "0")}/${date.getFullYear()}`;
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseLocalDateValue(value));
}

function getISOWeek(date: Date) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));

  return Math.ceil(((current.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function getPeriodDateCaption(period: PeriodKey, value: string) {
  const date = parseLocalDateValue(value);

  if (period === "all") {
    return "Toàn bộ dữ liệu";
  }

  if (period === "day") {
    return formatLongDate(value);
  }

  if (period === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);

    return `Tuần ${getISOWeek(start)} · ${formatDateDisplay(toLocalDateValue(start))} - ${formatDateDisplay(toLocalDateValue(end))}`;
  }

  if (period === "month") {
    return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  if (period === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const start = startOfQuarter(date);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);

    return `Quý ${quarter}/${date.getFullYear()} · ${formatDateDisplay(toLocalDateValue(start))} - ${formatDateDisplay(toLocalDateValue(end))}`;
  }

  return `Năm ${date.getFullYear()}`;
}

function getYearOptions(selectedDate: string) {
  const currentYear = parseLocalDateValue(getTodayInputValue()).getFullYear();
  const selectedYear = parseLocalDateValue(selectedDate).getFullYear();
  const startYear = Math.min(2020, selectedYear);

  return Array.from({ length: currentYear - startYear + 1 }, (_, index) => currentYear - index);
}

function getMonthOptions(year: number) {
  const today = parseLocalDateValue(getTodayInputValue());
  const lastMonth = year === today.getFullYear() ? today.getMonth() : 11;

  return Array.from({ length: lastMonth + 1 }, (_, month) => month);
}

function getQuarterOptions(year: number) {
  const today = parseLocalDateValue(getTodayInputValue());
  const lastQuarter = year === today.getFullYear() ? Math.floor(today.getMonth() / 3) : 3;

  return Array.from({ length: lastQuarter + 1 }, (_, quarter) => quarter);
}

function getWeeksInMonth(year: number, month: number): PeriodOption[] {
  const today = parseLocalDateValue(getTodayInputValue());
  const monthEnd = new Date(year, month + 1, 0);
  const safeEnd = monthEnd > today ? today : monthEnd;

  if (new Date(year, month, 1) > today) {
    return [];
  }

  return Array.from({ length: 4 }, (_, index) => {
    const start = new Date(year, month, index * 7 + 1);
    const rawEnd = index === 3 ? monthEnd : new Date(year, month, index * 7 + 7);
    const end = rawEnd > safeEnd ? safeEnd : rawEnd;

    return {
      label: `Tuần ${index + 1} · ${formatDateDisplay(toLocalDateValue(start))} - ${formatDateDisplay(toLocalDateValue(end))}`,
      value: toLocalDateValue(start),
    };
  }).filter((option) => parseLocalDateValue(option.value) <= safeEnd);
}

function buildMonthWeekTrend(
  points: PeriodChartPoint[],
  selectedDate: string
): PeriodChartPoint[] {
  const date = parseLocalDateValue(selectedDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthEnd = new Date(year, month + 1, 0);
  const today = parseLocalDateValue(getTodayInputValue());
  const safeEnd = monthEnd > today ? today : monthEnd;

  return Array.from({ length: 4 }, (_, index) => {
    const start = new Date(year, month, index * 7 + 1);
    const rawEnd = index === 3 ? monthEnd : new Date(year, month, index * 7 + 7);
    const end = rawEnd > safeEnd ? safeEnd : rawEnd;

    const weekPoints = points.filter((point) => {
      const pointDate = point.start ? parseLocalDateValue(point.start) : null;
      return pointDate && pointDate >= start && pointDate <= end;
    });

    return {
      label: `Tuần ${index + 1}`,
      start: toLocalDateValue(start),
      end: toLocalDateValue(end),
      income: weekPoints.reduce((total, point) => total + point.income, 0),
      expense: weekPoints.reduce((total, point) => total + point.expense, 0),
      net: weekPoints.reduce((total, point) => total + (point.net ?? point.income - point.expense), 0),
      transactionCount: weekPoints.reduce((total, point) => total + (point.transactionCount ?? 0), 0),
    };
  }).filter((point) => parseLocalDateValue(point.start ?? selectedDate) <= safeEnd);
}

function EmptyOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/35">
      <div className="rounded-2xl border border-orange-200 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
        Không có dữ liệu
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [categoryView, setCategoryView] = useState<CategoryView>("ALL");
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [data, setData] = useState<NormalizedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handlePeriodChange = (nextPeriod: PeriodKey) => {
    setPeriod(nextPeriod);
  };

  const selectedDateObject = parseLocalDateValue(selectedDate);
  const selectedYear = selectedDateObject.getFullYear();
  const selectedMonth = selectedDateObject.getMonth();
  const selectedQuarter = Math.floor(selectedMonth / 3);
  const yearOptions = getYearOptions(selectedDate);
  const monthOptions = getMonthOptions(selectedYear);
  const quarterOptions = getQuarterOptions(selectedYear);
  const weekOptions = getWeeksInMonth(selectedYear, selectedMonth);

  const updateYear = (year: number) => {
    const today = parseLocalDateValue(getTodayInputValue());
    const month = Math.min(selectedMonth, year === today.getFullYear() ? today.getMonth() : 11);
    const date =
      period === "year"
        ? new Date(year, 0, 1)
        : period === "quarter"
          ? new Date(year, Math.min(selectedQuarter, Math.floor(month / 3)) * 3, 1)
          : new Date(year, month, 1);

    setSelectedDate(toLocalDateValue(date));
  };

  const updateMonth = (month: number) => {
    setSelectedDate(toLocalDateValue(new Date(selectedYear, month, 1)));
  };

  const updateQuarter = (quarter: number) => {
    setSelectedDate(toLocalDateValue(new Date(selectedYear, quarter * 3, 1)));
  };

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api<unknown>(
          `/admin/dashboard?date=${selectedDate}&period=${period}`
        );
        setData(normalizeDashboard(response));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Không thể tải thống kê quản trị.");
      } finally {
        setLoading(false);
      }
    };

    void loadStatistics();
  }, [selectedDate, period]);

  const selectedSummary = data?.statistics.periods[period];
  const hasSelectedTransactions = Boolean(selectedSummary?.transactionCount);
  const categoryNames = useMemo(
    () =>
      new Map(
        data?.statistics.topCategories.map((category) => [
          category.categoryId,
          category.name,
        ]) ?? []
      ),
    [data]
  );

  const cashFlowData = useMemo(
    () =>
      selectedSummary
        ? [
            { name: "Thu", value: selectedSummary.income },
            { name: "Chi", value: selectedSummary.expense },
            { name: "Ròng", value: selectedSummary.net },
          ]
        : [],
    [selectedSummary]
  );

  if (loading) {
    return <div className="rounded-3xl bg-white p-6 text-sm text-slate-600">-</div>;
  }

  if (error || !data || !selectedSummary) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-red-600">
        {error || "-"}
      </div>
    );
  }

  const selectedCategories = data.statistics.systemCategoryTotals.map((category) => ({
    ...category,
    name: category.name ?? categoryNames.get(category.categoryId) ?? "Chưa phân loại",
  }));
  const personalCategories = data.statistics.personalCategoryTotals.map((category) => ({
    ...category,
    name: category.name ?? "Chưa phân loại",
  }));
  const filteredCategorySource = selectedCategories.filter((category) => {
    if (categoryView === "INCOME") {
      return category.income > 0;
    }

    if (categoryView === "EXPENSE") {
      return category.expense > 0;
    }

    return category.income > 0 || category.expense > 0;
  });
  const hasCategoryData = filteredCategorySource.length > 0;
  const hasPersonalCategoryData = personalCategories.length > 0;
  const normalizedTrendData =
    period === "month" ? buildMonthWeekTrend(data.periodChart, selectedDate) : data.periodChart;
  const trendData = normalizedTrendData.length
    ? normalizedTrendData
    : [{ label: "-", income: data.totalIncome, expense: data.totalExpense }];
  const incomeCategories = selectedCategories
    .filter((category) => category.income > 0)
    .sort((left, right) => right.income - left.income)
    .slice(0, 6);
  const expenseCategories = selectedCategories
    .filter((category) => category.expense > 0)
    .sort((left, right) => right.expense - left.expense)
    .slice(0, 6);
  const categoryChartData = filteredCategorySource.length
    ? filteredCategorySource.slice(0, 8).map((category) => ({
        name: category.name,
        Thu: category.income,
        Chi: category.expense,
      }))
    : [{ name: "-", Thu: 0, Chi: 0 }];
  const personalCategoryChartData = personalCategories.length
    ? personalCategories.slice(0, 8).map((category) => ({
        name: category.name,
        Thu: category.income,
        Chi: category.expense,
      }))
    : [{ name: "-", Thu: 0, Chi: 0 }];
  const topPersonalIncomeCategories = data.statistics.topPersonalIncomeCategories;
  const topPersonalExpenseCategories = data.statistics.topPersonalExpenseCategories;
  const hotHashtags = data.statistics.hotHashtags;
  const hashtagChartData = hotHashtags.length
    ? hotHashtags.map((item) => ({
        name: `#${item.tag}`,
        value: item.count,
        total: item.total,
      }))
    : [{ name: "-", value: 0, total: 0 }];
  const overviewCards = [
    { label: "Tổng thu", value: formatCurrency(selectedSummary.income, data.displayCurrency), note: periodLabels[period] },
    {
      label: "Tổng chi",
      value: formatCurrency(selectedSummary.expense, data.displayCurrency),
      note: `${selectedSummary.expenseToIncomeRate}%`,
    },
    {
      label: "Dòng tiền ròng",
      value: formatCurrency(selectedSummary.net, data.displayCurrency),
      note: selectedSummary.net >= 0 ? "+" : "-",
    },
    {
      label: "Chi tiêu trung bình",
      value: formatCurrency(
        selectedSummary.expenseCount > 0 ? selectedSummary.expense / selectedSummary.expenseCount : 0,
        data.displayCurrency
      ),
      note: periodLabels[period],
    },
    {
      label: "Tỷ lệ Premium",
      value: `${data.premiumRate}%`,
      note: `${data.premiumUsers} Premium · ${data.basicUsers} Basic`,
    },
    { label: "Ví âm", value: formatNumber(data.negativeWallets), note: "" },
    {
      label: "Ví vượt hạn mức",
      value: formatNumber(data.overBudgetWallets),
      note: "",
    },
    { label: "Người dùng", value: formatNumber(data.totalUsers), note: "" },
    { label: "Giao dịch", value: formatNumber(data.totalTransactions), note: "" },
    {
      label: "Basic chạm giới hạn",
      value: formatNumber(data.statistics.subscriptionStats.basicAtWalletLimit),
      note: `${data.statistics.subscriptionStats.basicLimitRate}% Basic đã dùng 2 ví`,
    },
    {
      label: "Premium dùng ví",
      value: data.statistics.subscriptionStats.premiumAverageWallets.toFixed(1),
      note: "Số ví trung bình mỗi Premium",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-orange-600">Bộ lọc thời gian</p>
            <p className="mt-1 text-sm text-slate-500">
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-1">
            {(Object.keys(periodLabels) as PeriodKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handlePeriodChange(item)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  period === item
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-slate-600 hover:bg-white/70",
                ].join(" ")}
              >
                {periodLabels[item]}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Kỳ đang xem
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {getPeriodDateCaption(period, selectedDate)}
              </p>
            </div>
            {period === "day" ? (
              <DatePickerInput
                value={selectedDate}
                onChange={setSelectedDate}
                label="Ngày"
                className="md:w-[320px]"
              />
            ) : period === "all" ? null : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Năm
                  <select
                    value={selectedYear}
                    onChange={(event) => updateYear(Number(event.target.value))}
                    className="h-10 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                {period === "week" || period === "month" ? (
                  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Tháng
                    <select
                      value={selectedMonth}
                      onChange={(event) => updateMonth(Number(event.target.value))}
                      className="h-10 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
                    >
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          Tháng {month + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {period === "quarter" ? (
                  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Quý
                    <select
                      value={selectedQuarter}
                      onChange={(event) => updateQuarter(Number(event.target.value))}
                      className="h-10 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
                    >
                      {quarterOptions.map((quarter) => (
                        <option key={quarter} value={quarter}>
                          Quý {quarter + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {period === "week" ? (
                  <div className="flex flex-wrap gap-2">
                    {weekOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedDate(option.value)}
                        className={[
                          "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                          startOfWeek(parseLocalDateValue(selectedDate)).getTime() ===
                          parseLocalDateValue(option.value).getTime()
                            ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                            : "border-orange-200 bg-white text-slate-700 hover:bg-orange-50",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <article
            key={card.label}
            className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-orange-600">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.note}</p>
          </article>
        ))}
      </div>

      <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Thu, chi và dòng tiền</h2>
        <div className="relative mt-5 h-72 min-w-0 overflow-hidden rounded-2xl">
          <div className={hasSelectedTransactions ? "min-w-0 h-full" : "pointer-events-none min-w-0 h-full opacity-30 blur-[1.5px]"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatAxisCurrency(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), data.displayCurrency)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {cashFlowData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        index === 0
                          ? "#16a34a"
                          : index === 1
                            ? "#f97316"
                            : selectedSummary.net >= 0
                              ? "#0ea5e9"
                              : "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {!hasSelectedTransactions ? <EmptyOverlay /> : null}
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Thống kê theo danh mục hệ thống</h2>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-1">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "INCOME", label: "Danh mục thu" },
              { key: "EXPENSE", label: "Danh mục chi" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategoryView(item.key as CategoryView)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  categoryView === item.key
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-slate-600 hover:bg-white/70",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-5 h-80 min-w-0 overflow-hidden rounded-2xl">
          <div className={hasCategoryData ? "min-w-0 h-full" : "pointer-events-none min-w-0 h-full opacity-30 blur-[1.5px]"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatAxisCurrency(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), data.displayCurrency)} />
                <Bar dataKey="Thu" fill="#16a34a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Chi" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {!hasCategoryData ? <EmptyOverlay /> : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="text-sm font-bold text-emerald-800">Danh mục thu nhiều nhất</h3>
            <div className="mt-3 space-y-2">
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-emerald-700">-</p>
              ) : (
                incomeCategories.map((category) => (
                  <div
                    key={category.categoryId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{category.name}</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(category.income, data.displayCurrency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <h3 className="text-sm font-bold text-orange-800">Danh mục chi nhiều nhất</h3>
            <div className="mt-3 space-y-2">
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-orange-700">-</p>
              ) : (
                expenseCategories.map((category) => (
                  <div
                    key={category.categoryId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{category.name}</span>
                    <span className="font-bold text-orange-700">
                      {formatCurrency(category.expense, data.displayCurrency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Thống kê theo danh mục cá nhân</h2>

        <div className="relative mt-5 h-80 min-w-0 overflow-hidden rounded-2xl">
          <div className={hasPersonalCategoryData ? "min-w-0 h-full" : "pointer-events-none min-w-0 h-full opacity-30 blur-[1.5px]"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={personalCategoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatAxisCurrency(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), data.displayCurrency)} />
                <Bar dataKey="Thu" fill="#16a34a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Chi" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {!hasPersonalCategoryData ? <EmptyOverlay /> : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="text-sm font-bold text-emerald-800">Top 5 danh mục thu cá nhân</h3>
            <div className="mt-3 space-y-2">
              {topPersonalIncomeCategories.length === 0 ? (
                <p className="text-sm text-emerald-700">-</p>
              ) : (
                topPersonalIncomeCategories.map((category) => (
                  <div
                    key={category.categoryId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{category.name}</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(category.income, data.displayCurrency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <h3 className="text-sm font-bold text-orange-800">Top 5 danh mục chi cá nhân</h3>
            <div className="mt-3 space-y-2">
              {topPersonalExpenseCategories.length === 0 ? (
                <p className="text-sm text-orange-700">-</p>
              ) : (
                topPersonalExpenseCategories.map((category) => (
                  <div
                    key={category.categoryId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{category.name}</span>
                    <span className="font-bold text-orange-700">
                      {formatCurrency(category.expense, data.displayCurrency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Xu hướng thu chi</h2>
        <div className="mt-5 h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(value) => formatAxisCurrency(Number(value))} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), data.displayCurrency)} />
              <Bar dataKey="income" name="Thu" fill="#16a34a" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" name="Chi" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {period === "month" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {trendData.length === 0 || trendData.every((item) => !item.transactionCount) ? (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-slate-600">
                Không có dữ liệu trong kỳ này.
              </div>
            ) : (
              trendData.map((item) => (
                <div key={`${item.start}-${item.end}`} className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {formatDateDisplay(item.start ?? selectedDate)} - {formatDateDisplay(item.end ?? selectedDate)}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="font-semibold text-emerald-700">Thu: {formatCurrency(item.income, data.displayCurrency)}</p>
                    <p className="font-semibold text-orange-700">Chi: {formatCurrency(item.expense, data.displayCurrency)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Hashtag hot</h2>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            {hotHashtags.length} hashtag
          </span>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="relative h-72 min-w-0 overflow-hidden rounded-2xl">
            <div className={hotHashtags.length ? "min-w-0 h-full" : "pointer-events-none min-w-0 h-full opacity-30 blur-[1.5px]"}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hashtagChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name, entry) =>
                      name === "total"
                        ? formatCurrency(Number(value), data.displayCurrency)
                        : [
                            `${formatNumber(Number(value))} giao dịch`,
                            `Tổng ${formatCurrency(Number(entry.payload.total), data.displayCurrency)}`,
                          ]
                    }
                  />
                  <Bar dataKey="value" name="Lượt dùng" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {hotHashtags.length ? null : <EmptyOverlay />}
          </div>

          <div className="space-y-3">
            {hotHashtags.length === 0 ? (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-slate-600">
                Chưa có hashtag trong kỳ này.
              </div>
            ) : (
              hotHashtags.map((item, index) => (
                <div
                  key={item.tag}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {index + 1}. #{item.tag}
                    </p>
                    <p className="mt-1 text-slate-600">{formatNumber(item.count)} giao dịch</p>
                  </div>
                  <p className="font-bold text-orange-700">
                    {formatCurrency(item.total, data.displayCurrency)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Cơ cấu người dùng</h2>
          <div className="mt-5 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statistics.roleDistribution}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  label
                >
                  {data.statistics.roleDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Sức khỏe ví</h2>
          <div className="mt-5 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statistics.walletHealth}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  label
                >
                  {data.statistics.walletHealth.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[(index + 1) % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Trạng thái đánh giá</h2>
          <div className="mt-5 space-y-3">
            {data.insights.map((insight) => (
              <div
                key={insight.title}
                className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm"
              >
                <p className="font-semibold text-slate-900">{insight.title}</p>
                <p className="mt-1 leading-6 text-slate-600">{insight.message}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
