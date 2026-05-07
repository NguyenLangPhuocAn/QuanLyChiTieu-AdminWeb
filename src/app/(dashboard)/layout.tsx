import MainLayout from "@/components/layout/MainLayout";

type DashboardLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
