export type InsightSeverity = "danger" | "warning" | "success";

export type DashboardInsight = {
  title: string;
  message: string;
  severity: InsightSeverity;
};

export type PeriodKey = "all" | "day" | "week" | "month" | "quarter" | "year";

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

export type PeriodChartPoint = {
  label: string;
  start?: string;
  end?: string;
  income: number;
  expense: number;
  net?: number;
  transactionCount?: number;
};

export type HotHashtag = {
  tag: string;
  total: number;
  count: number;
};

export type NormalizedDashboard = {
  displayCurrency: string;
  exchangeProvider?: string;
  exchangeProviderDocs?: string;
  exchangeAttributionUrl?: string;
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
  periodChart: PeriodChartPoint[];
  selectedPeriod: PeriodKey;
  periodRange?: { start: string; end: string };
  previousPeriodRange?: { start: string; end: string };
  comparison?: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
  };
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
    hotHashtags: HotHashtag[];
    walletHealth: Array<{ name: string; value: number }>;
    subscriptionStats: {
      basicUsers: number;
      premiumUsers: number;
      adminUsers: number;
      premiumRate: number;
      basicAtWalletLimit: number;
      basicNoWallet: number;
      basicLimitRate: number;
      premiumAverageWallets: number;
      upgradeOpportunityUsers: number;
    };
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
      message: `Chi tiêu hiện chiếm ${expenseRate}% thu `,
      severity: input.totalExpense >= input.totalIncome ? "danger" : "warning",
    });
  }

  if (input.negativeWallets > 0) {
    insights.push({
      title: "Gợi ý 3: Ví âm",
      message: `Có ${input.negativeWallets} ví đang âm `,
      severity: "danger",
    });
  }

  if (input.overBudgetWallets > 0) {
    insights.push({
      title: "Gợi ý 4: Vượt hạn mức",
      message: `Có ${input.overBudgetWallets} ví vượt hạn mức.`,
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
  const allPeriod = objectFrom(periods.all);
  const dayPeriod = objectFrom(periods.day);
  const monthPeriod = objectFrom(periods.month);
  const quarterPeriod = objectFrom(periods.quarter);
  const weekPeriod = objectFrom(periods.week);
  const yearPeriod = objectFrom(periods.year);
  const selectedPeriod = String(raw.selected_period ?? statistics.selectedPeriod ?? "month") as PeriodKey;
  const rawPeriodChart = raw.period_chart ?? statistics.periodChart ?? statistics.period_chart;
  const subscriptionStats = objectFrom(statistics.subscriptionStats);

  return {
    displayCurrency: String(raw.display_currency ?? statistics.display_currency ?? "VND"),
    exchangeProvider: typeof raw.exchange_provider === "string" ? raw.exchange_provider : undefined,
    exchangeProviderDocs:
      typeof raw.exchange_provider_docs === "string" ? raw.exchange_provider_docs : undefined,
    exchangeAttributionUrl:
      typeof raw.exchange_attribution_url === "string" ? raw.exchange_attribution_url : undefined,
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
    periodChart: arrayFrom<PeriodChartPoint>(rawPeriodChart).map((item) => ({
      label: String(item.label ?? "-"),
      start: typeof item.start === "string" ? item.start : undefined,
      end: typeof item.end === "string" ? item.end : undefined,
      income: numberFrom(item.income),
      expense: numberFrom(item.expense),
      net: numberFrom(item.net),
      transactionCount: numberFrom(item.transactionCount),
    })),
    selectedPeriod,
    periodRange: objectFrom(raw.period_range ?? statistics.periodRange) as { start: string; end: string },
    previousPeriodRange: objectFrom(raw.previous_period_range ?? statistics.previousPeriodRange) as { start: string; end: string },
    comparison: objectFrom(raw.comparison ?? statistics.comparison) as NormalizedDashboard["comparison"],
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
        all: { ...fallbackPeriod, ...allPeriod },
        day: { ...fallbackPeriod, ...dayPeriod },
        week: { ...fallbackPeriod, ...weekPeriod },
        month: { ...fallbackPeriod, ...monthPeriod },
        quarter: { ...fallbackPeriod, ...quarterPeriod },
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
      hotHashtags: arrayFrom<HotHashtag>(statistics.hotHashtags).map((item) => ({
        tag: String(item.tag ?? ""),
        total: numberFrom(item.total),
        count: numberFrom(item.count),
      })),
      walletHealth: arrayFrom(statistics.walletHealth).length
        ? arrayFrom(statistics.walletHealth)
        : [
            { name: "Ví ổn", value: Math.max(totalWallets - negativeWallets - overBudgetWallets, 0) },
            { name: "Ví âm", value: negativeWallets },
            { name: "Vượt hạn mức", value: overBudgetWallets },
          ],
      subscriptionStats: {
        basicUsers: numberFrom(subscriptionStats.basicUsers ?? basicUsers),
        premiumUsers: numberFrom(subscriptionStats.premiumUsers ?? premiumUsers),
        adminUsers: numberFrom(subscriptionStats.adminUsers ?? adminUsers),
        premiumRate: numberFrom(subscriptionStats.premiumRate ?? premiumRate),
        basicAtWalletLimit: numberFrom(subscriptionStats.basicAtWalletLimit),
        basicNoWallet: numberFrom(subscriptionStats.basicNoWallet),
        basicLimitRate: numberFrom(subscriptionStats.basicLimitRate),
        premiumAverageWallets: numberFrom(subscriptionStats.premiumAverageWallets),
        upgradeOpportunityUsers: numberFrom(subscriptionStats.upgradeOpportunityUsers),
      },
    },
  };
}
