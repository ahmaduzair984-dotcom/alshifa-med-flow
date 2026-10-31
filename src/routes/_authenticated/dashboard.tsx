import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  PackageCheck,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  FlaskConical,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { describeStock, expiryState, formatDate } from "@/lib/pharmacy";
import { PageHeader, StatCard, EmptyState, LoadingRows } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { DoctorProfile } from "@/components/DoctorProfile";
import { cachedQuery } from "@/lib/offline-queue";
import { isRetiredMedicine } from "@/lib/retired-medicines";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Al Shifa Family Clinic Pharmacy" },
      {
        name: "description",
        content:
          "Daily sales, profit, low stock and expiry overview for Al Shifa Family Clinic pharmacy.",
      },
      { property: "og:title", content: "Dashboard — Al Shifa Family Clinic Pharmacy" },
      {
        property: "og:description",
        content: "Daily sales, profit, low stock and expiry overview for the clinic pharmacy.",
      },
    ],
  }),
  component: Dashboard,
});

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function localDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function Dashboard() {
  const { can, isAdmin } = useAuth();

  const today = useQuery({
    queryKey: ["dashboard", "today", isAdmin],
    enabled: isAdmin,
    queryFn: () =>
      cachedQuery("dashboard:today-v2", async () => {
        const [sales, returns] = await Promise.all([
          supabase
            .from("sales")
            .select("total_paisa, profit_paisa, id")
            .eq("status", "completed")
            .gte("created_at", startOfToday()),
          supabase
            .from("sale_returns")
            .select("total_paisa, profit_adjustment_paisa, id")
            .gte("created_at", startOfToday()),
        ]);
        if (sales.error) throw sales.error;
        if (returns.error) throw returns.error;
        const refunds = (returns.data ?? []).reduce((sum, row) => sum + row.total_paisa, 0);
        const revenue = (sales.data ?? []).reduce((sum, row) => sum + row.total_paisa, 0) - refunds;
        const profit =
          (sales.data ?? []).reduce((sum, row) => sum + row.profit_paisa, 0) +
          (returns.data ?? []).reduce((sum, row) => sum + row.profit_adjustment_paisa, 0);
        return { revenue, profit, refunds, count: sales.data?.length ?? 0 };
      }),
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent-sales", isAdmin],
    enabled: isAdmin,
    queryFn: () =>
      cachedQuery("dashboard:recent-sales", async () => {
        const { data, error } = await supabase
          .from("sales")
          .select("id, invoice_no, total_paisa, created_at, patient_name, status")
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) throw error;
        return data;
      }),
  });

  const laboratory = useQuery({
    queryKey: ["dashboard", "laboratory", localDateKey(), isAdmin],
    enabled: isAdmin,
    queryFn: () =>
      cachedQuery(`dashboard:laboratory:${localDateKey()}`, async () => {
        const date = localDateKey();
        const { data, error } = await supabase.rpc("lab_financial_summary", {
          p_from: date,
          p_to: date,
        });
        if (error) throw error;
        return (data ?? EMPTY_LAB_SUMMARY) as unknown as LabSummary;
      }),
  });

  const stock = useQuery({
    queryKey: ["dashboard", "stock", isAdmin],
    queryFn: () =>
      cachedQuery(`dashboard:stock-${isAdmin ? "admin" : "staff"}-v3`, async () => {
        const productsResult = await supabase
          .from("products")
          .select("id, brand_name, strength, base_unit, pack_unit, units_per_pack, min_stock")
          .eq("is_active", true);
        const stockResult = isAdmin
          ? await supabase
              .from("product_stock")
              .select("product_id, sellable_base, stock_value_paisa, nearest_expiry")
          : await supabase
              .from("product_stock")
              .select("product_id, sellable_base, nearest_expiry");
        const { data: products, error: pErr } = productsResult;
        const { data: stockRows, error: sErr } = stockResult;
        if (pErr) throw pErr;
        if (sErr) throw sErr;
        const byId = new Map(
          (stockRows ?? []).map((row) => [
            row.product_id,
            row as {
              product_id: string;
              sellable_base: number | null;
              stock_value_paisa?: number | null;
              nearest_expiry: string | null;
            },
          ]),
        );
        const enriched = (products ?? [])
          .filter((product) => !isRetiredMedicine(product))
          .map((product) => {
            const row = byId.get(product.id);
            return {
              ...product,
              stock: row?.sellable_base ?? 0,
              value: isAdmin ? (row?.stock_value_paisa ?? 0) : 0,
              nearestExpiry: row?.nearest_expiry ?? null,
            };
          });
        return {
          lowStock: enriched
            .filter((item) => item.stock <= item.min_stock)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 6),
          stockValue: enriched.reduce((sum, item) => sum + item.value, 0),
          totalMedicines: enriched.length,
          outOfStock: enriched.filter((item) => item.stock <= 0).length,
        };
      }),
  });

  const expiring = useQuery({
    queryKey: ["dashboard", "expiring"],
    queryFn: () =>
      cachedQuery("dashboard:expiring-v2", async () => {
        const limit = new Date();
        limit.setDate(limit.getDate() + 90);
        const { data, error } = await supabase
          .from("product_batches")
          .select("id, batch_number, expiry_date, quantity_base, products(brand_name, base_unit)")
          .gt("quantity_base", 0)
          .not("expiry_date", "is", null)
          .lte("expiry_date", limit.toISOString().slice(0, 10))
          .order("expiry_date", { ascending: true })
          .limit(6);
        if (error) throw error;
        return (data ?? []).filter((batch) => !isRetiredMedicine(batch.products ?? {}));
      }),
  });

  return (
    <div>
      <PageHeader
        title="Assalam-o-Alaikum"
        description="Today's pharmacy activity at a glance."
        actions={
          <>
            {can("sell") && (
              <Button asChild>
                <Link to="/pos">
                  <ShoppingCart className="mr-2 size-4" /> New sale
                </Link>
              </Button>
            )}
            {can("sell_labs") && (
              <Button
                asChild
                className="bg-success font-semibold text-success-foreground shadow-md shadow-success/20 ring-1 ring-success/25 transition-all hover:-translate-y-0.5 hover:bg-success/90 hover:shadow-lg focus-visible:ring-success"
              >
                <Link to="/labs/new">
                  <FlaskConical className="mr-2 size-4" /> New Lab Sale
                </Link>
              </Button>
            )}
          </>
        }
      />

      <DoctorProfile />

      {stock.data?.lowStock.length || expiring.data?.length ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-warning" />
            <span>
              <strong>Attention needed:</strong> {stock.data?.lowStock.length ?? 0} low-stock
              medicine{(stock.data?.lowStock.length ?? 0) === 1 ? "" : "s"} and{" "}
              {expiring.data?.length ?? 0} batch{(expiring.data?.length ?? 0) === 1 ? "" : "es"}{" "}
              expiring within 90 days.
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/low-stock">Low stock</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/expiring">Expiring</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-2"}`}>
        {isAdmin && (
          <>
            <StatCard
              label="Today's sales"
              value={formatMoney(today.data?.revenue ?? 0)}
              hint={`${today.data?.count ?? 0} invoices · ${formatMoney(today.data?.refunds ?? 0)} refunded`}
              icon={<Banknote className="size-5" />}
              tone="primary"
              loading={today.isLoading}
            />
            <StatCard
              label="Today's profit"
              value={formatMoney(today.data?.profit ?? 0)}
              icon={<TrendingUp className="size-5" />}
              tone="success"
              loading={today.isLoading}
            />
            <StatCard
              label="Stock value"
              value={formatMoney(stock.data?.stockValue ?? 0)}
              hint={`${stock.data?.outOfStock ?? 0} items out of stock`}
              icon={<Receipt className="size-5" />}
              loading={stock.isLoading}
            />
          </>
        )}
        <StatCard
          label="Total medicines"
          value={(stock.data?.totalMedicines ?? 0).toLocaleString("en-PK")}
          hint="Active medicines in Inventory and Medicine Catalog"
          icon={<PackageCheck className="size-5" />}
          tone="success"
          loading={stock.isLoading}
        />
        <StatCard
          label="Expiring soon"
          value={expiring.data?.length ?? 0}
          hint="Batches within 90 days"
          icon={<CalendarClock className="size-5" />}
          tone="warning"
          loading={expiring.isLoading}
        />
      </div>

      {isAdmin && (
        <section className="mt-5 rounded-xl border border-success/20 bg-success/[0.03] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <FlaskConical className="size-5 text-success" /> Today's laboratory
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Laboratory finances are reported separately from medicine sales.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/labs">View lab sales</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lab invoices"
              value={(laboratory.data?.count ?? 0).toLocaleString("en-PK")}
              hint="Completed laboratory bills today"
              icon={<Receipt className="size-5" />}
              tone="primary"
              loading={laboratory.isLoading}
            />
            <StatCard
              label="Lab revenue"
              value={formatMoney(laboratory.data?.revenue_paisa ?? 0)}
              hint={`${formatMoney(laboratory.data?.discount_paisa ?? 0)} discounted`}
              icon={<Banknote className="size-5" />}
              tone="success"
              loading={laboratory.isLoading}
            />
            <StatCard
              label="Lab costs"
              value={formatMoney(laboratory.data?.cost_paisa ?? 0)}
              hint="Clinic and external laboratory costs"
              icon={<Receipt className="size-5" />}
              loading={laboratory.isLoading}
            />
            <StatCard
              label="Lab profit"
              value={formatMoney(laboratory.data?.profit_paisa ?? 0)}
              hint="Lab revenue minus lab costs"
              icon={<TrendingUp className="size-5" />}
              tone="success"
              loading={laboratory.isLoading}
            />
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Low stock</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/low-stock">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stock.isLoading ? (
              <LoadingRows rows={4} />
            ) : stock.data?.lowStock.length ? (
              <ul className="divide-y">
                {stock.data.lowStock.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.brand_name} {item.strength ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Minimum {item.min_stock} {item.base_unit}s
                      </p>
                    </div>
                    <Badge variant={item.stock <= 0 ? "destructive" : "secondary"}>
                      {describeStock(item.stock, item)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<TriangleAlert className="size-6" />}
                title="Stock levels are healthy"
                description="No medicine has fallen below its minimum stock level."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Expiring batches</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/expiring">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {expiring.isLoading ? (
              <LoadingRows rows={4} />
            ) : expiring.data?.length ? (
              <ul className="divide-y">
                {expiring.data.map((batch) => {
                  const state = expiryState(batch.expiry_date);
                  return (
                    <li key={batch.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {batch.products?.brand_name ?? "Medicine"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Batch {batch.batch_number} · {batch.quantity_base}{" "}
                          {batch.products?.base_unit ?? "unit"}s
                        </p>
                      </div>
                      <Badge variant={state === "expired" ? "destructive" : "secondary"}>
                        {formatDate(batch.expiry_date)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarClock className="size-6" />}
                title="Nothing expiring soon"
                description="No batches expire within the next 90 days."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent sales</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sales">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.isLoading ? (
              <LoadingRows rows={4} />
            ) : recent.data?.length ? (
              <ul className="divide-y">
                {recent.data.map((sale) => (
                  <li key={sale.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sale.invoice_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.patient_name || "Walk-in"} · {formatDate(sale.created_at)}
                      </p>
                    </div>
                    <span className="tabular text-sm font-semibold">
                      {formatMoney(sale.total_paisa)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="No sales yet"
                description="Sales will appear here once you bill your first patient."
                action={
                  can("sell") ? (
                    <Button asChild>
                      <Link to="/pos">Start a sale</Link>
                    </Button>
                  ) : null
                }
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
