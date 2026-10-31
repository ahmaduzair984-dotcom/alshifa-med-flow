import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui-kit";
import { formatMoney } from "@/lib/money";
import { formatDateTime, friendlyError } from "@/lib/pharmacy";

type Sale = {
  id: string;
  invoice_no: string;
  patient_name: string | null;
  created_at: string;
  total_paisa: number;
  sale_items: { product_name: string; quantity: number; unit_label: string }[];
};

type SaleItem = {
  id: string;
  product_name: string;
  batch_number: string | null;
  unit_label: string;
  quantity: number;
  quantity_base: number;
  returned_base: number;
  units_per_sale_unit: number;
  line_total_paisa: number;
  products: { base_unit: string } | null;
};

type CreatedReturn = {
  return_id: string;
  return_no: string;
  refund_paisa: number;
};

export type ReturnHistoryRow = {
  id: string;
  return_no: string;
  sale_id: string | null;
  source: string;
  medicines: string;
  invoice: string;
  patient: string;
  total_paisa: number;
  cost_paisa: number;
  profit_adjustment_paisa: number;
  reason: string | null;
  created_at: string;
};

type ReturnItem = {
  id: string;
  product_name: string;
  quantity_base: number;
  refund_paisa: number;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character,
  );
}

function soldItemSummary(sale: Sale) {
  const items = sale.sale_items ?? [];
  if (!items.length) return "No medicine items";
  const visible = items
    .slice(0, 2)
    .map((item) => `${item.product_name} × ${item.quantity}`)
    .join(", ");
  return items.length > 2 ? `${visible} +${items.length - 2} more` : visible;
}

export function CreateReturnDialog() {
  const [open, setOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();

  const sales = useQuery({
    queryKey: ["return-sales"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, invoice_no, patient_name, created_at, total_paisa, sale_items(product_name, quantity, unit_label)",
        )
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const items = useQuery({
    queryKey: ["return-sale-items", selectedSaleId],
    enabled: open && Boolean(selectedSaleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, product_name, batch_number, unit_label, quantity, quantity_base, returned_base, units_per_sale_unit, line_total_paisa, products(base_unit)",
        )
        .eq("sale_id", selectedSaleId)
        .order("created_at");
      if (error) throw error;
      return ((data ?? []) as unknown as SaleItem[]).filter(
        (item) => item.quantity_base > item.returned_base,
      );
    },
  });

  const selectedItems = useMemo(
    () =>
      (items.data ?? [])
        .map((item) => ({
          sale_item_id: item.id,
          quantity_base: quantities[item.id] ?? 0,
          maximum: item.quantity_base - item.returned_base,
          refund_paisa: Math.round(
            (item.line_total_paisa * (quantities[item.id] ?? 0)) / item.quantity_base,
          ),
        }))
        .filter((item) => item.quantity_base > 0),
    [items.data, quantities],
  );
  const estimatedRefund = selectedItems.reduce((sum, item) => sum + item.refund_paisa, 0);

  const reset = () => {
    setSelectedSaleId("");
    setQuantities({});
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Returns require an internet connection so stock stays accurate.");
      return;
    }
    if (!selectedSaleId) {
      toast.error("Select the original sale invoice.");
      return;
    }
    if (!selectedItems.length) {
      toast.error("Enter a return quantity for at least one medicine.");
      return;
    }
    if (
      selectedItems.some(
        (item) => !Number.isInteger(item.quantity_base) || item.quantity_base > item.maximum,
      )
    ) {
      toast.error("A return quantity is greater than the quantity still available to return.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSaving(true);
    const reason = String(form.get("reason") ?? "").trim();
    const { data, error } = await supabase.rpc("create_sale_return", {
      p_sale_id: selectedSaleId,
      p_items: selectedItems.map(({ sale_item_id, quantity_base }) => ({
        sale_item_id,
        quantity_base,
      })),
      ...(reason ? { p_reason: reason } : {}),
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error, "The return could not be recorded."));
      return;
    }

    const result = data as unknown as CreatedReturn;
    toast.success(
      `${result.return_no} recorded. Refund due: ${formatMoney(result.refund_paisa)}. Stock has been restored.`,
    );
    reset();
    setOpen(false);
    await client.invalidateQueries();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !saving) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <RotateCcw className="mr-2 size-4" /> New return
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record medicine return</DialogTitle>
          <DialogDescription>
            Select the original invoice and enter the medicine quantities being returned. The app
            calculates the refund and restores stock to the original batch.
          </DialogDescription>
        </DialogHeader>
        {sales.isLoading ? (
          <LoadingRows rows={4} />
        ) : sales.isError ? (
          <ErrorState message={friendlyError(sales.error, "Sales could not be loaded.")} />
        ) : (
          <form className="space-y-4" onSubmit={save}>
            <div>
              <Label htmlFor="return-sale">Original invoice</Label>
              <SearchableSelect
                id="return-sale"
                name="sale_id"
                placeholder="Select or search invoice"
                searchPlaceholder="Search invoice, medicine, date, or amount..."
                emptyMessage="No matching sale invoice found."
                onValueChange={(value) => {
                  setSelectedSaleId(value);
                  setQuantities({});
                }}
                options={(sales.data ?? []).map((sale) => ({
                  value: sale.id,
                  label: `${sale.invoice_no} — ${formatDateTime(sale.created_at)} — ${soldItemSummary(sale)} — ${formatMoney(sale.total_paisa)}`,
                  searchText: `${sale.invoice_no} ${sale.patient_name ?? ""} ${formatDateTime(sale.created_at)} ${formatMoney(sale.total_paisa)} ${(sale.sale_items ?? []).map((item) => item.product_name).join(" ")}`,
                }))}
              />
            </div>

            {selectedSaleId && items.isLoading ? (
              <LoadingRows rows={3} />
            ) : items.isError ? (
              <ErrorState
                message={friendlyError(items.error, "Invoice medicines could not be loaded.")}
              />
            ) : selectedSaleId && !items.data?.length ? (
              <EmptyState
                title="Nothing available to return"
                description="This invoice has no medicines, or all sold quantities have already been returned."
              />
            ) : items.data?.length ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">Medicines from this invoice</h3>
                  <p className="text-xs text-muted-foreground">
                    Enter zero for medicines that are not being returned.
                  </p>
                </div>
                {items.data.map((item) => {
                  const available = item.quantity_base - item.returned_base;
                  const baseUnit = item.products?.base_unit ?? "unit";
                  const quantity = quantities[item.id] ?? 0;
                  const refund = Math.round(
                    (item.line_total_paisa * quantity) / item.quantity_base,
                  );
                  return (
                    <Card key={item.id}>
                      <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_180px] sm:items-end">
                        <div className="min-w-0">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Sold: {item.quantity} {item.unit_label}
                            {item.batch_number ? ` · Batch ${item.batch_number}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Up to {available} {baseUnit}
                            {available === 1 ? "" : "s"} can still be returned.
                          </p>
                        </div>
                        <div>
                          <Label htmlFor={`return-quantity-${item.id}`}>
                            Return quantity ({baseUnit})
                          </Label>
                          <Input
                            id={`return-quantity-${item.id}`}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max={available}
                            step="1"
                            value={quantity}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: Number(event.target.value),
                              }))
                            }
                            className="mt-1"
                          />
                          {quantity > 0 && (
                            <p className="mt-1 text-xs font-medium text-success">
                              Refund: {formatMoney(refund)}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            <div>
              <Label htmlFor="return-reason">Reason / note</Label>
              <Textarea
                id="return-reason"
                name="reason"
                className="mt-1"
                placeholder="e.g. Wrong medicine supplied or patient returned sealed pack"
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3 font-medium">
                <span>Refund due</span>
                <span className="text-base">{formatMoney(estimatedRefund)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Only medicines are included. Service charges and clinical services are not added
                back to pharmacy stock.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !selectedItems.length}>
                {saving ? "Recording return..." : "Record return & restore stock"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReturnDetailsDialog({ returnRecord }: { returnRecord: ReturnHistoryRow }) {
  const [open, setOpen] = useState(false);
  const details = useQuery({
    queryKey: ["return-details", returnRecord.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_items")
        .select("id, product_name, quantity_base, refund_paisa")
        .eq("return_id", returnRecord.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ReturnItem[];
    },
  });

  const print = () => {
    if (!details.data) return;
    const page = window.open("", `return-${returnRecord.return_no}`, "width=460,height=700");
    if (!page) {
      toast.error("Please allow pop-ups to print this return receipt.");
      return;
    }
    const rows = details.data
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity_base}</td><td>${escapeHtml(formatMoney(item.refund_paisa))}</td></tr>`,
      )
      .join("");
    page.document
      .write(`<!doctype html><html><head><title>${escapeHtml(returnRecord.return_no)}</title><style>
      body{font-family:Arial,sans-serif;max-width:680px;margin:24px auto;padding:0 18px;color:#152b55}h1{font-size:21px;margin:0}h2{font-size:14px;color:#198b39;margin:4px 0 18px}p{color:#222}table{width:100%;border-collapse:collapse;margin-top:16px;color:#111;font-size:13px}th,td{padding:9px 7px;border-bottom:1px solid #d9e0e8;text-align:left}th:last-child,td:last-child{text-align:right}.total{font-size:17px;font-weight:bold;text-align:right}.footer{margin-top:24px;border-top:1px solid #ccd5e2;padding-top:12px;text-align:center;font-size:11px;color:#657086}@media print{body{margin:0 auto}}
    </style></head><body><h1>AL SHIFA FAMILY CLINIC</h1><h2>Medicine Return Receipt</h2>
      <p><strong>Return:</strong> ${escapeHtml(returnRecord.return_no)}${returnRecord.sale_id ? `<br><strong>Invoice:</strong> ${escapeHtml(returnRecord.invoice)}<br><strong>Patient:</strong> ${escapeHtml(returnRecord.patient)}` : "<br><strong>Type:</strong> Direct medicine return (no invoice)"}<br><strong>Date:</strong> ${escapeHtml(formatDateTime(returnRecord.created_at))}</p>
      <table><thead><tr><th>Medicine</th><th>Quantity</th><th>Refund</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="total">Refund: ${escapeHtml(formatMoney(returnRecord.total_paisa))}</p>${returnRecord.reason ? `<p><strong>Reason:</strong> ${escapeHtml(returnRecord.reason)}</p>` : ""}
      <p class="footer">Software developed by Ahmad Uzair Tarar</p><script>window.onload=()=>window.print()</script></body></html>`);
    page.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="mr-1 size-4" /> View / print
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return {returnRecord.return_no}</DialogTitle>
          <DialogDescription>
            {returnRecord.sale_id
              ? `${returnRecord.invoice} · ${returnRecord.patient}`
              : "Direct medicine return · No invoice required"}{" "}
            · {formatDateTime(returnRecord.created_at)}
          </DialogDescription>
        </DialogHeader>
        {details.isLoading ? (
          <LoadingRows rows={3} />
        ) : details.isError ? (
          <ErrorState
            message={friendlyError(details.error, "Return details could not be loaded.")}
          />
        ) : (
          <div className="space-y-4">
            <div className="divide-y rounded-lg border">
              {(details.data ?? []).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-muted-foreground">Quantity returned: {item.quantity_base}</p>
                  </div>
                  <p className="font-medium">{formatMoney(item.refund_paisa)}</p>
                </div>
              ))}
            </div>
            {returnRecord.reason && (
              <p className="rounded-lg bg-muted/50 p-3 text-sm">
                <strong>Reason:</strong> {returnRecord.reason}
              </p>
            )}
            <div className="flex items-center justify-between gap-3 border-t pt-3 font-semibold">
              <span>Total refund</span>
              <span>{formatMoney(returnRecord.total_paisa)}</span>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={print} disabled={!details.data?.length}>
                <Printer className="mr-2 size-4" /> Print return receipt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
