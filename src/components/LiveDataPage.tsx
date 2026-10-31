import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ErrorState, EmptyState, LoadingRows, PageHeader } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, friendlyError } from "@/lib/pharmacy";
import { cachedQuery } from "@/lib/offline-queue";
import { isRetiredMedicine } from "@/lib/retired-medicines";

export type DisplayRow = Record<string, unknown>;
export type AdminDeleteTable =
  | "products"
  | "clinical_services"
  | "lab_tests"
  | "lab_sales"
  | "patients"
  | "suppliers"
  | "expenses"
  | "sales"
  | "purchases"
  | "sale_returns";
export type DeleteConfig = {
  table: AdminDeleteTable;
  recordLabel: string;
  archiveIfLinked?: boolean;
};
export type LivePageProps = {
  title: string;
  description: string;
  load: () => Promise<DisplayRow[]>;
  actions?: ReactNode;
  deleteConfig?: DeleteConfig;
  rowActions?: (row: DisplayRow) => ReactNode;
  maxColumns?: number;
  showSerialNumber?: boolean;
  compactTable?: boolean;
  columnLabels?: Record<string, string>;
  hiddenColumns?: string[];
};

const defaultColumnLabels: Record<string, string> = {
  brand_name: "Medicine",
  generic_name: "Generic",
  dosage_form: "Form",
  base_unit: "Unit",
  min_stock: "Min. stock",
  minimum_stock: "Min. stock",
  average_buying_price_paisa: "Avg. buy",
  sale_price_paisa: "Sale price",
  selling_price_paisa: "Sale price",
  stock_value_paisa: "Stock value",
  nearest_expiry: "Expiry",
  prescription_required: "Prescription",
  created_at: "Added",
};

function columnLabel(key: string, labels?: Record<string, string>) {
  return labels?.[key] ?? defaultColumnLabels[key] ?? key.replaceAll("_", " ");
}

function text(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (key.endsWith("_paisa") && typeof value === "number") return formatMoney(value);
  if (key.includes("date") || key === "created_at")
    return typeof value === "string"
      ? key === "created_at"
        ? formatDateTime(value)
        : formatDate(value)
      : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "payment_method") {
    const labels: Record<string, string> = {
      cash: "Cash",
      card: "Card",
      bank: "Bank transfer",
      other: "Other",
    };
    return labels[String(value)] ?? String(value);
  }
  return String(value);
}

function recordName(row: DisplayRow) {
  const key = recordNameKey(row);
  return key ? String(row[key]) : "this record";
}

function recordNameKey(row: DisplayRow) {
  return [
    "medicine",
    "brand_name",
    "name",
    "invoice_no",
    "return_no",
    "reference",
    "description",
    "category",
  ].find((candidate) => row[candidate]);
}

export function LiveDataPage({
  title,
  description,
  load,
  actions,
  deleteConfig,
  rowActions,
  maxColumns = 7,
  showSerialNumber = false,
  compactTable = false,
  columnLabels,
  hiddenColumns = [],
}: LivePageProps) {
  const { isAdmin } = useAuth();
  const client = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<DisplayRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({ queryKey: ["live-page", title], queryFn: load });
  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle
      ? (query.data ?? []).filter((row) =>
          Object.values(row).some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(needle),
          ),
        )
      : (query.data ?? []);
  }, [filter, query.data]);
  const columns = useMemo(
    () =>
      Object.keys(rows[0] ?? query.data?.[0] ?? {})
        .filter(
          (key) =>
            key !== "id" &&
            !key.endsWith("_id") &&
            key !== "updated_at" &&
            !hiddenColumns.includes(key),
        )
        .slice(0, maxColumns),
    [hiddenColumns, maxColumns, rows, query.data],
  );
  const canDelete = isAdmin && Boolean(deleteConfig);
  const canShowActions = canDelete || Boolean(rowActions);

  const deleteSelected = async () => {
    const id = String(selected?.["id"] ?? "");
    if (!id || !deleteConfig) return;
    if (!navigator.onLine) {
      toast.error("Deleting records requires an internet connection.");
      return;
    }
    setDeleting(true);
    const result = deleteConfig.archiveIfLinked
      ? deleteConfig.table === "clinical_services"
        ? await supabase.rpc("admin_remove_clinical_service", { p_service_id: id })
        : deleteConfig.table === "lab_tests"
          ? await supabase.rpc("admin_remove_lab_test", { p_lab_test_id: id })
          : await supabase.rpc("admin_remove_medicine", { p_product_id: id })
      : deleteConfig.table === "sale_returns"
        ? await supabase.rpc("admin_delete_return", { p_return_id: id })
        : deleteConfig.table === "lab_sales"
          ? await supabase.rpc("admin_delete_lab_sale", { p_lab_sale_id: id })
          : await supabase.rpc("admin_delete_record", {
              p_table: deleteConfig.table,
              p_record_id: id,
            });
    setDeleting(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    const action = (result.data as { action?: string } | null)?.action;
    toast.success(
      action === "archived"
        ? `${deleteConfig.recordLabel} removed from active use. Its history is preserved.`
        : `${deleteConfig.recordLabel} permanently deleted.`,
    );
    setSelected(null);
    await client.invalidateQueries();
  };

  return (
    <div>
      <PageHeader title={title} description={description} actions={actions} />
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search this list"
            className="pl-9"
          />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4">
              <LoadingRows />
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <ErrorState message="This information could not be loaded. Please refresh and try again." />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={filter ? "No matching records" : "No records yet"}
                description={
                  filter
                    ? "Try a different search."
                    : "Records will appear here as they are added to the clinic system."
                }
              />
            </div>
          ) : (
            <>
              <div className={compactTable ? "divide-y xl:hidden" : "divide-y md:hidden"}>
                {rows.map((row, index) => (
                  <div key={String(row["id"] ?? index)} className="space-y-2 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {showSerialNumber && (
                        <span className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                      )}
                      <p className="min-w-0 break-words font-medium leading-6">{recordName(row)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {columns
                        .filter((key) => key !== recordNameKey(row))
                        .map((key) => (
                          <div key={key} className="min-w-0">
                            <p className="text-xs capitalize leading-5 text-muted-foreground">
                              {columnLabel(key, columnLabels)}
                            </p>
                            <p className="break-words leading-5">{text(row[key], key)}</p>
                          </div>
                        ))}
                    </div>
                    {canShowActions && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rowActions?.(row)}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:text-destructive"
                            onClick={() => setSelected(row)}
                          >
                            <Trash2 className="mr-1 size-4" /> Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div
                className={
                  compactTable
                    ? "hidden overflow-hidden xl:block"
                    : "hidden overflow-x-auto md:block"
                }
              >
                <table
                  className={
                    compactTable ? "w-full table-fixed text-[13px]" : "w-full min-w-[620px] text-sm"
                  }
                >
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {showSerialNumber && (
                        <th className="w-12 px-2 py-3 text-center font-medium" scope="col">
                          No.
                        </th>
                      )}
                      {columns.map((key) => (
                        <th
                          key={key}
                          className={
                            compactTable
                              ? "break-words px-2.5 py-3 font-medium leading-4"
                              : "whitespace-nowrap px-4 py-3 font-medium"
                          }
                          scope="col"
                        >
                          {columnLabel(key, columnLabels)}
                        </th>
                      ))}
                      {canShowActions && (
                        <th
                          className={
                            compactTable
                              ? "w-36 px-2.5 py-3 text-right font-medium"
                              : "px-4 py-3 text-right font-medium"
                          }
                          scope="col"
                        >
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={String(row["id"] ?? index)}
                        className="border-b transition-colors last:border-0 hover:bg-muted/30"
                      >
                        {showSerialNumber && (
                          <td className="tabular px-2 py-2.5 text-center font-medium text-muted-foreground">
                            {index + 1}
                          </td>
                        )}
                        {columns.map((key) => (
                          <td
                            key={key}
                            className={
                              compactTable
                                ? "break-words px-2.5 py-2.5 align-top leading-5"
                                : "max-w-56 px-4 py-3 align-top"
                            }
                          >
                            {text(row[key], key)}
                          </td>
                        ))}
                        {canShowActions && (
                          <td
                            className={
                              compactTable ? "px-2 py-2 text-right" : "px-4 py-2 text-right"
                            }
                          >
                            <div className="flex flex-wrap justify-end gap-1">
                              {rowActions?.(row)}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setSelected(row)}
                                >
                                  <Trash2 className="mr-1 size-4" /> Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setSelected(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfig?.archiveIfLinked
                ? `Remove ${deleteConfig.recordLabel}?`
                : `Delete ${deleteConfig?.recordLabel}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfig?.archiveIfLinked
                ? `${recordName(selected ?? {})} will be permanently deleted if it has no history. If it is linked to purchases or sales, it will be archived and hidden while those records remain safe.`
                : `You are about to permanently delete ${recordName(selected ?? {})}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={() => void deleteSelected()}>
              {deleting
                ? "Removing..."
                : deleteConfig?.archiveIfLinked
                  ? `Remove ${deleteConfig.recordLabel}`
                  : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function list(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<DisplayRow[]> {
  const result = await query;
  if (result.error) throw result.error;
  return (result.data as DisplayRow[] | null) ?? [];
}

export const liveLoaders = {
  labTests: () =>
    cachedQuery("live:lab-tests-v1", async () => {
      const { data, error } = await supabase.rpc("list_lab_tests_with_costs");
      if (error) throw error;
      return (data ?? []) as DisplayRow[];
    }),
  labSales: async () => {
    const rows = await cachedQuery("live:lab-sales-v1", async () => {
      const { data, error } = await supabase
        .from("lab_sales")
        .select(
          "id, invoice_no, created_at, patient_name, patient_age, patient_gender, patient_phone, referring_doctor, subtotal_paisa, discount_paisa, total_paisa, paid_paisa, change_paisa, payment_method, status, note, lab_sale_items(id, test_name, category, quantity, unit_price_paisa, line_total_paisa)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    });
    return rows.map((row) => ({
      id: row.id,
      invoice_no: row.invoice_no,
      created_at: row.created_at,
      patient_name: row.patient_name,
      tests: row.lab_sale_items.length
        ? row.lab_sale_items
            .map((item) => `${item.test_name}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
            .join(", ")
        : "No test details",
      total_paisa: row.total_paisa,
      paid_paisa: row.paid_paisa,
      payment_method: row.payment_method,
      patient_age: row.patient_age,
      patient_gender: row.patient_gender,
      patient_phone: row.patient_phone,
      referring_doctor: row.referring_doctor,
      subtotal_paisa: row.subtotal_paisa,
      discount_paisa: row.discount_paisa,
      change_paisa: row.change_paisa,
      status: row.status,
      note: row.note,
      lab_sale_items: row.lab_sale_items,
    }));
  },
  clinicalServices: () =>
    cachedQuery("live:clinical-services", () =>
      list(
        supabase
          .from("clinical_services")
          .select("id, name, category, price_paisa, cost_paisa, sort_order, is_active, created_at")
          .eq("is_active", true)
          .order("sort_order")
          .order("name")
          .limit(200),
      ),
    ),
  medicines: async () =>
    (
      await cachedQuery("live:medicines", () =>
        list(
          supabase
            .from("products")
            .select(
              "id, brand_name, generic_name, strength, dosage_form, manufacturer, base_unit, sale_price_paisa, min_stock, barcode, prescription_required, notes, is_active, created_at",
            )
            .eq("is_active", true)
            .order("brand_name")
            .limit(1000),
        ),
      )
    ).filter((medicine) => !isRetiredMedicine(medicine)),
  patients: () =>
    cachedQuery("live:patients", () =>
      list(
        supabase
          .from("patients")
          .select("id, code, name, phone, age, gender, address, notes, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ),
    ),
  suppliers: () =>
    cachedQuery("live:suppliers", () =>
      list(
        supabase
          .from("suppliers")
          .select("id, name, company, contact_person, phone, email, is_active, created_at")
          .order("name")
          .limit(200),
      ),
    ),
  expenses: () =>
    cachedQuery("live:expenses", () =>
      list(
        supabase
          .from("expenses")
          .select(
            "id, expense_date, category, description, amount_paisa, payment_method, notes, created_at",
          )
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
      ),
    ),
  sales: async () => {
    const rows = await cachedQuery("live:sales-v3", async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, invoice_no, created_at, patient_name, total_paisa, paid_paisa, payment_method, status, subtotal_paisa, discount_paisa, clinical_service_paisa, service_charge_paisa, change_paisa, note, sale_items(product_name, quantity, unit_label), sale_service_items(service_name, quantity)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    });
    return rows.map((row) => {
      const items = (row.sale_items ?? []) as {
        product_name: string;
        quantity: number;
        unit_label: string;
      }[];
      const services = (row.sale_service_items ?? []) as {
        service_name: string;
        quantity: number;
      }[];
      const itemSummary =
        [
          ...items.map((item) => `${item.product_name} × ${item.quantity} ${item.unit_label}`),
          ...services.map((service) => `${service.service_name} × ${service.quantity}`),
        ].join(", ") || "No items";
      return {
        id: row.id,
        invoice_no: row.invoice_no,
        created_at: row.created_at,
        patient_name: row.patient_name,
        items_sold: itemSummary,
        total_paisa: row.total_paisa,
        paid_paisa: row.paid_paisa,
        payment_method: row.payment_method,
        status: row.status,
        subtotal_paisa: row.subtotal_paisa,
        discount_paisa: row.discount_paisa,
        clinical_service_paisa: row.clinical_service_paisa,
        service_charge_paisa: row.service_charge_paisa,
        change_paisa: row.change_paisa,
        note: row.note,
      };
    });
  },
  purchases: async () => {
    const rows = await cachedQuery("live:purchases-v2", async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(
          "id, reference, purchase_date, subtotal_paisa, discount_paisa, total_paisa, paid_paisa, note, created_at, suppliers(name, company), purchase_items(id, product_name, batch_number, expiry_date, quantity_base, cost_price_paisa, line_total_paisa, products(base_unit))",
        )
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    });

    return rows.map((row) => {
      const items = (row.purchase_items ?? []).map((item) => ({
        id: item.id,
        product_name: item.product_name,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        quantity_base: item.quantity_base,
        cost_price_paisa: item.cost_price_paisa,
        line_total_paisa: item.line_total_paisa,
        base_unit: item.products?.base_unit || "unit(s)",
      }));
      const supplier = row.suppliers
        ? `${row.suppliers.name}${row.suppliers.company ? ` — ${row.suppliers.company}` : ""}`
        : "Not selected";
      const medicine = items.length
        ? items
            .map(
              (item) =>
                `${item.product_name}: ${item.quantity_base} ${item.base_unit} @ ${formatMoney(item.cost_price_paisa)} each`,
            )
            .join(" • ")
        : "No medicine details";

      return {
        id: row.id,
        purchase_date: row.purchase_date,
        reference: row.reference,
        supplier,
        medicine,
        total_paisa: row.total_paisa,
        paid_paisa: row.paid_paisa,
        subtotal_paisa: row.subtotal_paisa,
        discount_paisa: row.discount_paisa,
        note: row.note,
        purchase_items: items,
        created_at: row.created_at,
      };
    });
  },
  returns: async () => {
    const rows = await cachedQuery("live:returns-v2", async () => {
      const { data, error } = await supabase
        .from("sale_returns")
        .select(
          "id, return_no, sale_id, source, total_paisa, cost_paisa, profit_adjustment_paisa, reason, created_at, sales(invoice_no, patient_name), return_items(product_name, quantity_base)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    });
    return rows.map((row) => {
      const sale = row.sales as { invoice_no?: string; patient_name?: string | null } | null;
      const items = (row.return_items ?? []) as {
        product_name: string;
        quantity_base: number;
      }[];
      return {
        id: row.id,
        return_no: row.return_no,
        sale_id: row.sale_id,
        source: row.source === "direct" ? "Direct return" : "Invoice return",
        medicines: items.length
          ? items.map((item) => `${item.product_name} × ${item.quantity_base}`).join(", ")
          : "-",
        invoice: sale?.invoice_no ?? "Not required",
        patient: sale?.patient_name ?? "-",
        total_paisa: row.total_paisa,
        cost_paisa: row.cost_paisa,
        profit_adjustment_paisa: row.profit_adjustment_paisa,
        reason: row.reason,
        created_at: row.created_at,
      };
    });
  },
  audit: () =>
    cachedQuery("live:audit", () =>
      list(
        supabase
          .from("audit_logs")
          .select("id, action, entity, description, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ),
    ),
  inventory: async () =>
    (
      await cachedQuery("live:inventory", async () => {
        const [{ data: products, error: productError }, { data: stock, error: stockError }] =
          await Promise.all([
            supabase
              .from("products")
              .select(
                "id, brand_name, strength, base_unit, min_stock, sale_price_paisa, cost_price_paisa, is_active",
              )
              .eq("is_active", true)
              .order("brand_name"),
            supabase
              .from("product_stock")
              .select("product_id, stock_base, sellable_base, stock_value_paisa, nearest_expiry"),
          ]);
        if (productError) throw productError;
        if (stockError) throw stockError;
        const byProduct = new Map((stock ?? []).map((row) => [row.product_id, row]));
        return (products ?? []).map((product) => {
          const current = byProduct.get(product.id);
          const stockBase = current?.stock_base ?? 0;
          const stockValue = current?.stock_value_paisa ?? 0;
          return {
            id: product.id,
            medicine: `${product.brand_name}${product.strength ? ` ${product.strength}` : ""}`,
            base_unit: product.base_unit,
            stock: current?.sellable_base ?? 0,
            minimum_stock: product.min_stock,
            average_buying_price_paisa:
              stockBase > 0 ? Math.round(stockValue / stockBase) : (product.cost_price_paisa ?? 0),
            selling_price_paisa: product.sale_price_paisa,
            stock_value_paisa: stockValue,
            nearest_expiry: current?.nearest_expiry ?? null,
          };
        }) as DisplayRow[];
      })
    ).filter((row) => !isRetiredMedicine({ brand_name: row["medicine"] })),
  lowStock: async () =>
    (await liveLoaders.inventory()).filter(
      (row) => Number(row["stock"] ?? 0) <= Number(row["minimum_stock"] ?? 0),
    ),
  batches: async () =>
    (
      await cachedQuery("live:batches", () =>
        list(
          supabase
            .from("product_batches")
            .select(
              "id, batch_number, expiry_date, quantity_base, initial_quantity_base, cost_price_paisa, products(brand_name, strength), created_at",
            )
            .order("expiry_date", { ascending: true })
            .limit(1000),
        ),
      )
    ).filter(
      (row) =>
        !isRetiredMedicine(
          (row["products"] as { brand_name?: unknown; strength?: unknown } | null) ?? {},
        ),
    ),
  settings: () =>
    cachedQuery("live:settings", () =>
      list(
        supabase
          .from("settings")
          .select(
            "id, clinic_name, doctor_name, phone, currency, expiry_warning_days, low_stock_default, updated_at",
          )
          .limit(10),
      ),
    ),
  users: () =>
    cachedQuery("live:users", () =>
      list(
        supabase
          .from("profiles")
          .select("id, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    ),
};
