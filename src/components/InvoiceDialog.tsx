import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Printer } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState, LoadingRows } from "@/components/ui-kit";
import { formatMoney } from "@/lib/money";
import { formatDateTime, friendlyError } from "@/lib/pharmacy";
import { cachedQuery } from "@/lib/offline-queue";

export type InvoiceSale = {
  id: string;
  invoice_no: string;
  created_at: string;
  patient_name: string | null;
  subtotal_paisa: number;
  clinical_service_paisa: number;
  discount_paisa: number;
  service_charge_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  change_paisa: number;
  payment_method: string;
  status: string;
  note: string | null;
};

type MedicineLine = {
  id: string;
  product_name: string;
  batch_number: string | null;
  unit_label: string;
  quantity: number;
  quantity_base: number;
  units_per_sale_unit: number;
  unit_price_paisa: number;
  discount_paisa: number;
  line_total_paisa: number;
  returned_base: number;
};

type ServiceLine = {
  id: string;
  service_name: string;
  category: string;
  quantity: number;
  unit_price_paisa: number;
  line_total_paisa: number;
};

type ReturnRow = {
  id: string;
  return_no: string;
  total_paisa: number;
  reason: string | null;
  created_at: string;
};

type InvoiceDetails = {
  medicines: MedicineLine[];
  services: ServiceLine[];
  returns: ReturnRow[];
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character,
  );
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function printInvoice(sale: InvoiceSale, details: InvoiceDetails) {
  const page = window.open("", `invoice-${sale.invoice_no}`, "width=460,height=760");
  if (!page) {
    toast.error("Please allow pop-ups to print this invoice.");
    return;
  }

  const medicineRows = details.medicines
    .map(
      (line) => `<tr>
        <td><strong>${escapeHtml(line.product_name)}</strong>${line.batch_number ? `<br><small>Batch: ${escapeHtml(line.batch_number)}</small>` : ""}${line.returned_base ? `<br><small class="returned">Returned: ${line.returned_base}</small>` : ""}</td>
        <td class="center">${line.quantity} ${escapeHtml(line.unit_label)}</td>
        <td class="right">${formatMoney(line.unit_price_paisa)}</td>
        <td class="right">${formatMoney(line.line_total_paisa)}</td>
      </tr>`,
    )
    .join("");
  const serviceRows = details.services
    .map(
      (line) => `<tr>
        <td><strong>${escapeHtml(line.service_name)}</strong><br><small>${escapeHtml(line.category)}</small></td>
        <td class="center">${line.quantity}</td>
        <td class="right">${formatMoney(line.unit_price_paisa)}</td>
        <td class="right">${formatMoney(line.line_total_paisa)}</td>
      </tr>`,
    )
    .join("");
  const returnRows = details.returns
    .map(
      (item) =>
        `<p class="return"><strong>${escapeHtml(item.return_no)}</strong> · ${escapeHtml(formatDateTime(item.created_at))}<span>${formatMoney(item.total_paisa)}</span>${item.reason ? `<br><small>${escapeHtml(item.reason)}</small>` : ""}</p>`,
    )
    .join("");

  page.document.write(`<!doctype html>
    <html><head><title>${escapeHtml(sale.invoice_no)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 18px;color:#152b55}
      h1{font-size:22px;margin:0}h2{font-size:15px;margin:3px 0 16px;color:#198b39}p{margin:5px 0;color:#222}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;border-block:1px solid #ccd5e2;padding:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:16px;color:#111;font-size:13px}th{background:#edf3fa;text-align:left}
      th,td{padding:9px 7px;border-bottom:1px solid #d9e0e8;vertical-align:top}.right{text-align:right}.center{text-align:center}
      small{color:#606b7b}.returned{color:#b42318}.summary{margin:14px 0 0 auto;max-width:330px}.summary p{display:flex;justify-content:space-between}
      .summary .total{border-top:2px solid #152b55;padding-top:8px;font-size:17px;font-weight:bold}.return{border-bottom:1px solid #ddd;padding:6px 0}.return span{float:right}
      .footer{margin-top:24px;border-top:1px solid #ccd5e2;padding-top:12px;text-align:center;font-size:11px;color:#657086}
      @media(max-width:520px){.meta{grid-template-columns:1fr}.hide-mobile{display:none}}@media print{body{margin:0 auto}.no-print{display:none}}
    </style></head><body>
      <h1>AL SHIFA FAMILY CLINIC</h1><h2>Dr. Saqlain Abbas Chattha</h2>
      <div class="meta">
        <p><strong>Invoice:</strong> ${escapeHtml(sale.invoice_no)}</p>
        <p><strong>Date:</strong> ${escapeHtml(formatDateTime(sale.created_at))}</p>
        <p><strong>Patient:</strong> ${escapeHtml(sale.patient_name ?? "Walk-in Customer")}</p>
        <p><strong>Payment:</strong> ${escapeHtml(titleCase(sale.payment_method))}</p>
        <p><strong>Status:</strong> ${escapeHtml(titleCase(sale.status))}</p>
      </div>
      <table><thead><tr><th>Item / service</th><th class="center">Quantity</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead>
      <tbody>${medicineRows}${serviceRows}${!medicineRows && !serviceRows ? '<tr><td colspan="4">No item details are available for this historical record.</td></tr>' : ""}</tbody></table>
      <div class="summary">
        <p><span>Subtotal</span><span>${formatMoney(sale.subtotal_paisa)}</span></p>
        ${sale.clinical_service_paisa ? `<p><span>Procedures / clinical services</span><span>${formatMoney(sale.clinical_service_paisa)}</span></p>` : ""}
        ${sale.discount_paisa ? `<p><span>Discount</span><span>-${formatMoney(sale.discount_paisa)}</span></p>` : ""}
        ${sale.service_charge_paisa ? `<p><span>Other service charges</span><span>${formatMoney(sale.service_charge_paisa)}</span></p>` : ""}
        <p class="total"><span>Total</span><span>${formatMoney(sale.total_paisa)}</span></p>
        <p><span>Paid</span><span>${formatMoney(sale.paid_paisa)}</span></p>
        <p><span>Change</span><span>${formatMoney(sale.change_paisa)}</span></p>
      </div>
      ${sale.note ? `<p><strong>Note:</strong> ${escapeHtml(sale.note)}</p>` : ""}
      ${returnRows ? `<h3>Returns / refunds</h3>${returnRows}` : ""}
      <p class="footer">Thank you for choosing Al Shifa Family Clinic.<br>Software developed by Ahmad Uzair Tarar</p>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  page.document.close();
}

async function loadInvoiceDetails(saleId: string): Promise<InvoiceDetails> {
  return cachedQuery(`invoice-details-v1:${saleId}`, async () => {
    const [medicineResult, serviceResult, returnResult] = await Promise.all([
      supabase
        .from("sale_items")
        .select(
          "id, product_name, batch_number, unit_label, quantity, quantity_base, units_per_sale_unit, unit_price_paisa, discount_paisa, line_total_paisa, returned_base",
        )
        .eq("sale_id", saleId)
        .order("created_at"),
      supabase
        .from("sale_service_items")
        .select("id, service_name, category, quantity, unit_price_paisa, line_total_paisa")
        .eq("sale_id", saleId)
        .order("created_at"),
      supabase
        .from("sale_returns")
        .select("id, return_no, total_paisa, reason, created_at")
        .eq("sale_id", saleId)
        .order("created_at"),
    ]);
    if (medicineResult.error) throw medicineResult.error;
    if (serviceResult.error) throw serviceResult.error;
    if (returnResult.error) throw returnResult.error;
    return {
      medicines: (medicineResult.data ?? []) as MedicineLine[],
      services: (serviceResult.data ?? []) as ServiceLine[],
      returns: (returnResult.data ?? []) as ReturnRow[],
    };
  });
}

export function InvoiceDialog({ sale }: { sale: InvoiceSale }) {
  const [open, setOpen] = useState(false);
  const details = useQuery({
    queryKey: ["invoice-details", sale.id],
    queryFn: () => loadInvoiceDetails(sale.id),
    enabled: open,
  });
  const refundTotal = (details.data?.returns ?? []).reduce(
    (sum, item) => sum + item.total_paisa,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="mr-1 size-4" /> View / print
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice {sale.invoice_no}</DialogTitle>
          <DialogDescription>
            {formatDateTime(sale.created_at)} · {sale.patient_name ?? "Walk-in Customer"}
          </DialogDescription>
        </DialogHeader>
        {details.isLoading ? (
          <LoadingRows />
        ) : details.isError ? (
          <ErrorState
            message={friendlyError(details.error, "Invoice details could not be loaded.")}
          />
        ) : details.data ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Patient:</span>{" "}
                {sale.patient_name ?? "Walk-in Customer"}
              </p>
              <p>
                <span className="text-muted-foreground">Payment:</span>{" "}
                {titleCase(sale.payment_method)}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {titleCase(sale.status)}
              </p>
              <p>
                <span className="text-muted-foreground">Date:</span>{" "}
                {formatDateTime(sale.created_at)}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3">Item / service</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3 text-center">Quantity</th>
                    <th className="p-3 text-right">Unit price</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {details.data.medicines.map((line) => (
                    <tr className="border-t" key={line.id}>
                      <td className="p-3 font-medium">
                        {line.product_name}
                        {line.returned_base > 0 && (
                          <p className="text-xs font-normal text-destructive">
                            {line.returned_base} base unit(s) returned
                          </p>
                        )}
                      </td>
                      <td className="p-3">{line.batch_number ?? "-"}</td>
                      <td className="p-3 text-center">
                        {line.quantity} {line.unit_label}
                      </td>
                      <td className="p-3 text-right">{formatMoney(line.unit_price_paisa)}</td>
                      <td className="p-3 text-right">{formatMoney(line.line_total_paisa)}</td>
                    </tr>
                  ))}
                  {details.data.services.map((line) => (
                    <tr className="border-t" key={line.id}>
                      <td className="p-3 font-medium">
                        {line.service_name}
                        <p className="text-xs font-normal text-muted-foreground">{line.category}</p>
                      </td>
                      <td className="p-3">-</td>
                      <td className="p-3 text-center">{line.quantity}</td>
                      <td className="p-3 text-right">{formatMoney(line.unit_price_paisa)}</td>
                      <td className="p-3 text-right">{formatMoney(line.line_total_paisa)}</td>
                    </tr>
                  ))}
                  {!details.data.medicines.length && !details.data.services.length && (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                        No item details are available for this historical record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-sm space-y-1 rounded-lg border p-3">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(sale.subtotal_paisa)}</span>
              </p>
              {sale.clinical_service_paisa > 0 && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Procedures / clinical services</span>
                  <span>{formatMoney(sale.clinical_service_paisa)}</span>
                </p>
              )}
              {sale.discount_paisa > 0 && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatMoney(sale.discount_paisa)}</span>
                </p>
              )}
              {sale.service_charge_paisa > 0 && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Other service charges</span>
                  <span>{formatMoney(sale.service_charge_paisa)}</span>
                </p>
              )}
              <p className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(sale.total_paisa)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatMoney(sale.paid_paisa)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Change</span>
                <span>{formatMoney(sale.change_paisa)}</span>
              </p>
              {refundTotal > 0 && (
                <p className="flex justify-between text-destructive">
                  <span>Returned / refunded</span>
                  <span>{formatMoney(refundTotal)}</span>
                </p>
              )}
            </div>

            {sale.note && (
              <p className="rounded-lg border p-3">
                <span className="font-medium">Note:</span> {sale.note}
              </p>
            )}
            {details.data.returns.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 font-semibold">Returns / refunds</p>
                {details.data.returns.map((item) => (
                  <div
                    className="flex flex-wrap justify-between gap-2 border-t py-2 first:border-0"
                    key={item.id}
                  >
                    <span>
                      {item.return_no} · {formatDateTime(item.created_at)}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </span>
                    <span className="font-medium text-destructive">
                      {formatMoney(item.total_paisa)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={() => printInvoice(sale, details.data)}>
                <Printer className="mr-2 size-4" /> Print invoice
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
