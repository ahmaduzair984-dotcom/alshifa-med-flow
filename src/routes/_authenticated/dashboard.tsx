import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { describeStock, expiryState, formatDate } from "@/lib/pharmacy";
import { PageHeader, StatCard, EmptyState, LoadingRows } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

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

function Dashboard() {
  const { fullName, can } = useAuth();

  const today = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total_paisa, profit_paisa, id")
        .eq("status", "completed")
        .gte("created_at", startOfToday());
      if (error) throw error;
      const revenue = data.reduce((sum, row) => sum + row.total_paisa, 0);
      const profit = data.reduce((sum, row) => sum + row.profit_paisa, 0);
      return { revenue, profit, count: data.length };
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, total_paisa, created_at, patient_name, status")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const stock = useQuery({
    queryKey: ["dashboard", "stock"],
    queryFn: async () => {
      const [{ data: products, error: pErr }, { data: stockRows, error: sErr }] =
        await Promise.all([
          supabase
            .from("products")
            .select("id, brand_name, strength, base_unit, pack_unit, units_per_pack, min_stock")
            .eq("is_active", true),
          supabase.from("product_stock").select("*"),
        ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      const byId = new Map(stockRows?.map((row) => [row.product_id, row]));
      const enriched = (products ?? []).map((product) => {
        const row = byId.get(product.id);
        return {
          ...product,
          stock: row?.sellable_base ?? 0,
          value: row?.stock_value_paisa ?? 0,
          nearestExpiry: row?.nearest_expiry ?? null,
        };
      });
      return {
        lowStock: enriched
          .filter((item) => item.stock <= item.min_stock)
          .sort((a, b) => a.stock - b.stock)
          .slice(0, 6),
        stockValue: enriched.reduce((sum, item) => sum + item.value, 0),
        outOfStock: enriched.filter((item) => item.stock <= 0).length,
      };
    },
  });

  const expiring = useQuery({
    queryKey: ["dashboard", "expiring"],
    queryFn: async () => {
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
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title={`Assalam-o-Alaikum${fullName ? `, ${fullName.split(" ")[0]}` : ""}`}
        description="Today's pharmacy activity at a glance."
        actions={
          can("sell") ? (
            <Button asChild>
              <Link to="/pos">
                <ShoppingCart className="mr-2 size-4" /> New sale
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatMoney(today.data?.revenue ?? 0)}
          hint={`${today.data?.count ?? 0} invoices`}
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
        <StatCard
          label="Expiring soon"
          value={expiring.data?.length ?? 0}
          hint="Batches within 90 days"
          icon={<CalendarClock className="size-5" />}
          tone="warning"
          loading={expiring.isLoading}
        />
      </div>

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
    </div>
  );
}
