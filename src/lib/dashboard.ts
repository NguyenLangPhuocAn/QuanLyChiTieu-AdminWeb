export type InsightSeverity = "danger" | "warning" | "success";

export type DashboardInsight = {
  title: string;
  message: string;
  severity: InsightSeverity;
};

export type PeriodKey = "day" | "week" | "month" | "year";

export type PeriodSummary = {
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  averageTransaction: number;
  expenseToIncomeRate: number;
  biggestIncome: number;
  biggestExpense: number;
  categoryTotals: Array<{
    categoryId: number;
    income: number;
    expense: number;
    total: number;
  }>;
};

export type NormalizedDashboard = {
  totalUsers: number;
  premiumUsers: number;
  basicUsers: number;
  adminUsers: number;
  totalWallets: number;
  totalCategories: number;
  totalTransactions: number;
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  negativeWallets: number;
  overBudgetWallets: number;
  premiumRate: number;
  averageWalletBalance: number;
  chart: Array<{ month: string; income: number; expense: number }>;
  recentLogs: Array<{
    id: number;
    admin_id?: number | null;
    action?: string | null;
    created_at?: string | null;
  }>;
  insights: DashboardInsight[];
  statistics: {
    periods: Record<PeriodKey, PeriodSummary>;
    roleDistribution: Array<{ name: string; value: number }>;
    topCategories: Array<{
      categoryId: number;
      name: string;
      income: number;
      expense: number;
      total: number;
    }>;
    topWallets: Array<{
      walletId: number;
      name: string;
      total: number;
    }>;
    walletHealth: Array<{ name: string; value: number }>;
  };
};

type RawDashboard = Record<string, unknown>;

const emptyPeriod: PeriodSummary = {
  income: 0,
  expense: 0,
  net: 0,
  transactionCount: 0,
  incomeCount: 0,
  expenseCount: 0,
  averageTransaction: 0,
  expenseToIncomeRate: 0,
  biggestIncome: 0,
  biggestExpense: 0,
  categoryTotals: [],
};

function numberFrom(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function objectFrom(value: unknown): RawDashboard {
  return value && typeof value === "object" ? (value as RawDashboard) : {};
}

function arrayFrom<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buildPeriod(income: number, expense: number, transactionCount = 0): PeriodSummary {
  return {
    ...emptyPeriod,
    income,
    expense,
    net: income - expense,
    transactionCount,
    averageTransaction: transactionCount > 0 ? (income + expense) / transactionCount : 0,
    expenseToIncomeRate: income > 0 ? Math.round((expense / income) * 100) : expense > 0 ? 100 : 0,
    biggestIncome: income,
    biggestExpense: expense,
  };
}

export function buildDashboardInsights(input: {
  premiumRate: number;
  totalIncome: number;
  totalExpense: number;
  negativeWallets: number;
  overBudgetWallets: number;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const expenseRate =
    input.totalIncome > 0
      ? Math.round((input.totalExpense / input.totalIncome) * 100)
      : input.totalExpense > 0
        ? 100
        : 0;

  if (input.premiumRate < 20) {
    insights.push({
      title: "Gợi ý 1: Premium",
      message: `Tỷ lệ Premium hiện tại: ${input.premiumRate}%. Cần tăng thêm để cải thiện doanh thu.`,
      severity: "warning",
    });
  }

  if (input.totalExpense >= input.totalIncome * 0.9 && (input.totalIncome > 0 || input.totalExpense > 0)) {
    insights.push({
      title: "Gợi ý 2: Thu/Chi",
      message: `Chi hiện chiếm ${expenseRate}% thu → cần kiểm tra chi tiêu bất thường.`,
      severity: input.totalExpense >= input.totalIncome ? "danger" : "warning",
    });
  }

  if (input.negativeWallets > 0) {
    insights.push({
      title: "Gợi ý 3: Ví âm",
      message: `Có ${input.negativeWallets} ví đang âm → cần cảnh báo người dùng.`,
      severity: "danger",
    });
  }

  if (input.overBudgetWallets > 0) {
    insights.push({
      title: "Gợi ý 4: Vượt budget",
      message: `Có ${input.overBudgetWallets} ví vượt hạn mức → cần cảnh báo người dùng.`,
      severity: "danger",
    });
  }

  if (insights.length === 0) {
    return [
      {
        title: "Hệ thống ổn định",
        message: "Không phát hiện vấn đề nổi bật từ dữ liệu dashboard hiện tại.",
        severity: "success",
      },
    ];
  }

  return insights.slice(0, 3).map((insight, index) => ({
    ...insight,
    title: insight.title.replace(/^Gợi ý \d+:/, `Gợi ý ${index + 1}:`),
  }));
}

export function normalizeDashboard(rawValue: unknown): NormalizedDashboard {
  const raw = objectFrom(rawValue);
  const summary = objectFrom(raw.summary);
  const statistics = objectFrom(raw.statistics);
  const periods = objectFrom(statistics.periods);
  const totalUsers = numberFrom(raw.total_users ?? summary.totalUsers);
  const premiumUsers = numberFrom(raw.premium_users ?? summary.premiumUsers);
  const basicUsers = numberFrom(raw.basic_users ?? summary.basicUsers ?? Math.max(totalUsers - premiumUsers, 0));
  const adminUsers = numberFrom(raw.admin_users ?? summary.adminUsers);
  const totalWallets = numberFrom(raw.total_wallets ?? summary.totalWallets);
  const totalCategories = numberFrom(raw.total_categories ?? summary.totalCategories);
  const totalTransactions = numberFrom(raw.total_transactions ?? summary.totalTransactions);
  const totalBalance = numberFrom(raw.total_balance ?? summary.totalBalance);
  const totalIncome = numberFrom(raw.total_income ?? summary.monthIncome);
  const totalExpense = numberFrom(raw.total_expense ?? summary.monthExpense);
  const negativeWallets = numberFrom(raw.negative_wallets ?? summary.negativeWallets);
  const overBudgetWallets = numberFrom(raw.over_budget_wallets ?? summary.overBudgetWallets);
  const premiumRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;
  const fallbackPeriod = buildPeriod(totalIncome, totalExpense, totalTransactions);
  const dayPeriod = objectFrom(periods.day);
  const monthPeriod = objectFrom(periods.month);
  const weekPeriod = objectFrom(periods.week);
  const yearPeriod = objectFrom(periods.year);

  return {
    totalUsers,
    premiumUsers,
    basicUsers,
    adminUsers,
    totalWallets,
    totalCategories,
    totalTransactions,
    totalBalance,
    totalIncome,
    totalExpense,
    negativeWallets,
    overBudgetWallets,
    premiumRate,
    averageWalletBalance: numberFrom(raw.average_wallet_balance ?? summary.averageWalletBalance),
    chart: arrayFrom(raw.chart),
    recentLogs: arrayFrom(raw.recentLogs ?? raw.recent_logs),
    insights: buildDashboardInsights({
      premiumRate,
      totalIncome,
      totalExpense,
      negativeWallets,
      overBudgetWallets,
    }),
    statistics: {
      periods: {
        day: { ...fallbackPeriod, ...dayPeriod },
        week: { ...fallbackPeriod, ...weekPeriod },
        month: { ...fallbackPeriod, ...monthPeriod },
        year: { ...fallbackPeriod, ...yearPeriod },
      },
      roleDistribution: arrayFrom(statistics.roleDistribution).length
        ? arrayFrom(statistics.roleDistribution)
        : [
            { name: "Basic", value: basicUsers },
            { name: "Premium", value: premiumUsers },
            { name: "Admin", value: adminUsers },
          ],
      topCategories: arrayFrom(statistics.topCategories),
      topWallets: arrayFrom(statistics.topWallets),
      walletHealth: arrayFrom(statistics.walletHealth).length
        ? arrayFrom(statistics.walletHealth)
        : [
            { name: "Ví ổn", value: Math.max(totalWallets - negativeWallets - overBudgetWallets, 0) },
            { name: "Ví âm", value: negativeWallets },
            { name: "Vượt hạn mức", value: overBudgetWallets },
          ],
    },
  };
}
