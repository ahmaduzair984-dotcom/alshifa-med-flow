import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FlaskConical,
  Printer,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingRows, PageHeader, StatCard } from "@/components/ui-kit";
import { formatMoney } from "@/lib/money";
import { formatDate, friendlyError } from "@/lib/pharmacy";

type SaleRow = {
  id: string;
  created_at: string;
  invoice_no: string;
  patient_name: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  clinical_service_paisa: number;
  service_charge_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  profit_paisa: number;
  payment_method: string;
  status: string;
};
type ExpenseRow = { expense_date: string; amount_paisa: number };
type ReturnFinanceRow = {
  total_paisa: number;
  profit_adjustment_paisa: number;
  created_at: string;
};
type LabSummary = {
  count: number;
  revenue_paisa: number;
  subtotal_paisa: number;
  discount_paisa: number;
  cost_paisa: number;
  profit_paisa: number;
};
const EMPTY_LAB_SUMMARY: LabSummary = {
  count: 0,
  revenue_paisa: 0,
  subtotal_paisa: 0,
  discount_paisa: 0,
  cost_paisa: 0,
  profit_paisa: 0,
};
const localDate = (daysAgo = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function downloadCsv(rows: SaleRow[]) {
  const columns = [
    "Invoice",
    "Date",
    "Patient",
    "Payment method",
    "Subtotal (Rs.)",
    "Discount (Rs.)",
    "Procedures / clinical services (Rs.)",
    "Other service charges (Rs.)",
    "Total (Rs.)",
    "Paid (Rs.)",
    "Profit (Rs.)",
    "Status",
  ];
  const lines = [
    columns,
    ...rows.map((sale) => [
      sale.invoice_no,
      formatDate(sale.created_at),
      sale.patient_name ?? "Walk-in",
      sale.payment_method,
      (sale.subtotal_paisa / 100).toFixed(2),
      (sale.discount_paisa / 100).toFixed(2),
      (sale.clinical_service_paisa / 100).toFixed(2),
      (sale.service_charge_paisa / 100).toFixed(2),
      (sale.total_paisa / 100).toFixed(2),
      (sale.paid_paisa / 100).toFixed(2),
      (sale.profit_paisa / 100).toFixed(2),
      sale.status,
    ]),
  ];
  const blob = new Blob([lines.map((row) => row.map(csvCell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `al-shifa-sales-${localDate()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsDashboard() {
  const [from, setFrom] = useState(() => localDate(29));
  const [to, setTo] = useState(() => localDate());
  const report = useQuery({
    queryKey: ["sales-report", from, to],
    queryFn: async () => {
      const [sales, expenses, returns, labSummary] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, created_at, invoice_no, patient_name, subtotal_paisa, discount_paisa, clinical_service_paisa, service_charge_paisa, total_paisa, paid_paisa, profit_paisa, payment_method, status",
          )
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59`)
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("expense_date, amount_paisa")
          .gte("expense_date", from)
          .lte("expense_date", to),
        supabase
          .from("sale_returns")
          .select("total_paisa, profit_adjustment_paisa, created_at")
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59`),
        supabase.rpc("lab_financial_summary", { p_from: from, p_to: to }),
      ]);
      if (sales.error) throw sales.error;
      if (expenses.error) throw expenses.error;
      if (returns.error) throw returns.error;
      if (labSummary.error) throw labSummary.error;
      return {
        sales: sales.data as SaleRow[],
        expenses: expenses.data as ExpenseRow[],
        returns: returns.data as ReturnFinanceRow[],
        labSummary: (labSummary.data ?? EMPTY_LAB_SUMMARY) as unknown as LabSummary,
      };
    },
  });
  const totals = useMemo(() => {
    const sales = (report.data?.sales ?? []).filter((sale) => sale.status === "completed");
    const expenses = report.data?.expenses ?? [];
    const returns = report.data?.returns ?? [];
    const grossRevenue = sales.reduce((sum, sale) => sum + sale.total_paisa, 0);
    const refunds = returns.reduce((sum, item) => sum + item.total_paisa, 0);
    const revenue = grossRevenue - refunds;
    const grossProfit = sales.reduce((sum, sale) => sum + sale.profit_paisa, 0);
    const returnAdjustment = returns.reduce((sum, item) => sum + item.profit_adjustment_paisa, 0);
    const profit = grossProfit + returnAdjustment;
    const expense = expenses.reduce((sum, item) => sum + item.amount_paisa, 0);
    return {
      count: sales.length,
      grossRevenue,
      refunds,
      revenue,
      profit,
      expense,
      net: profit - expense,
    };
  }, [report.data]);
  const sales = report.data?.sales ?? [];
  return (
    <div>
      <PageHeader
        title="Medicine & Laboratory Reports"
        description="Medicine and laboratory finances are calculated and displayed separately."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" /> Print
            </Button>
            <Button variant="outline" disabled={!sales.length} onClick={() => downloadCsv(sales)}>
              <Download className="mr-2 size-4" /> Medicine CSV
            </Button>
          </>
        }
      />
      <Card className="no-print mb-4">
        <CardContent className="grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-end">
          <label className="text-sm">
            From
            <Input
              className="mt-1"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-sm">
            To
            <Input
              className="mt-1"
              type="date"
              value={to}
              min={from}
              max={localDate()}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <p className="pb-1 text-xs text-muted-foreground">
            Cancelled or reversed sales are excluded from totals.
          </p>
        </CardContent>
      </Card>
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Medicine and clinic finances</h2>
        <p className="text-sm text-muted-foreground">
          Medicine returns and clinic expenses affect this section only.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Medicine invoices"
          value={totals.count}
          icon={<ReceiptText className="size-5" />}
          loading={report.isLoading}
        />
        <StatCard
          label="Medicine revenue"
          value={formatMoney(totals.revenue)}
          tone="success"
          icon={<WalletCards className="size-5" />}
          loading={report.isLoading}
        />
        <StatCard
          label="Medicine refunds"
          value={formatMoney(totals.refunds)}
          tone="danger"
          loading={report.isLoading}
        />
        <StatCard
          label="Expenses"
          value={formatMoney(totals.expense)}
          tone="warning"
          loading={report.isLoading}
        />
        <StatCard
          label="Medicine net profit"
          value={formatMoney(totals.net)}
          tone={totals.net < 0 ? "danger" : "primary"}
          icon={<TrendingUp className="size-5" />}
          loading={report.isLoading}
        />
      </div>
      <Card className="mt-5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="size-5 text-primary" /> Laboratory finances
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            These figures are independent and are never added to medicine revenue or medicine
            profit.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lab invoices"
              value={report.data?.labSummary.count ?? 0}
              icon={<ReceiptText className="size-5" />}
              loading={report.isLoading}
            />
            <StatCard
              label="Lab revenue"
              value={formatMoney(report.data?.labSummary.revenue_paisa ?? 0)}
              tone="success"
              icon={<WalletCards className="size-5" />}
              loading={report.isLoading}
            />
            <StatCard
              label="Lab costs"
              value={formatMoney(report.data?.labSummary.cost_paisa ?? 0)}
              tone="warning"
              loading={report.isLoading}
            />
            <StatCard
              label="Lab profit"
              value={formatMoney(report.data?.labSummary.profit_paisa ?? 0)}
              tone={(report.data?.labSummary.profit_paisa ?? 0) < 0 ? "danger" : "primary"}
              icon={<TrendingUp className="size-5" />}
              loading={report.isLoading}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Lab discounts: {formatMoney(report.data?.labSummary.discount_paisa ?? 0)}. Laboratory
            profit equals lab revenue minus the private costs saved in the Lab Test Catalogue.
          </p>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Medicine invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.isLoading ? (
            <div className="p-4">
              <LoadingRows />
            </div>
          ) : report.isError ? (
            <div className="p-4">
              <ErrorState
                message={friendlyError(report.error, "The report could not be loaded.")}
              />
            </div>
          ) : !sales.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No sales in the selected date range.
            </p>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {sales.map((sale) => (
                  <div className="space-y-2 p-4" key={sale.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{sale.invoice_no}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(sale.created_at)} · {sale.patient_name ?? "Walk-in"}
                        </p>
                      </div>
                      <p className="font-semibold">{formatMoney(sale.total_paisa)}</p>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount {formatMoney(sale.discount_paisa)}</span>
                      <span>Procedures {formatMoney(sale.clinical_service_paisa)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Other charges {formatMoney(sale.service_charge_paisa)}</span>
                      <span className="capitalize">{sale.payment_method}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Status: {sale.status}</span>
                      <span>Profit {formatMoney(sale.profit_paisa)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="p-3">Invoice</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3 text-right">Discount</th>
                      <th className="p-3 text-right">Procedures</th>
                      <th className="p-3 text-right">Other charges</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr className="border-b" key={sale.id}>
                        <td className="p-3 font-medium">{sale.invoice_no}</td>
                        <td className="p-3">{formatDate(sale.created_at)}</td>
                        <td className="p-3">{sale.patient_name ?? "Walk-in"}</td>
                        <td className="p-3 capitalize">{sale.payment_method}</td>
                        <td className="p-3 text-right">{formatMoney(sale.discount_paisa)}</td>
                        <td className="p-3 text-right">
                          {formatMoney(sale.clinical_service_paisa)}
                        </td>
                        <td className="p-3 text-right">{formatMoney(sale.service_charge_paisa)}</td>
                        <td className="p-3 text-right">{formatMoney(sale.total_paisa)}</td>
                        <td className="p-3 text-right">{formatMoney(sale.profit_paisa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
