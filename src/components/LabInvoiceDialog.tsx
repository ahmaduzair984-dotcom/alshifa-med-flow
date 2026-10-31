import { useState } from "react";
import { Eye, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/pharmacy";

export type LabInvoiceLine = {
  id: string;
  test_name: string;
  category: string;
  quantity: number;
  unit_price_paisa: number;
  line_total_paisa: number;
};

export type LabInvoiceSale = {
  id: string;
  invoice_no: string;
  created_at: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  patient_phone: string | null;
  referring_doctor: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  change_paisa: number;
  payment_method: string;
  status: string;
  note: string | null;
  lab_sale_items: LabInvoiceLine[];
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

export function printLabReceipt(sale: LabInvoiceSale) {
  const page = window.open("", "al-shifa-lab-receipt", "width=480,height=760");
  if (!page) {
    toast.error("Please allow pop-ups to print the laboratory receipt.");
    return;
  }
  const rows = sale.lab_sale_items
    .map(
      (line) =>
        `<tr><td><strong>${escapeHtml(line.test_name)}</strong><br><small>${escapeHtml(line.category)} · ${line.quantity} × ${escapeHtml(formatMoney(line.unit_price_paisa))}</small></td><td class="right">${escapeHtml(formatMoney(line.line_total_paisa))}</td></tr>`,
    )
    .join("");
  const patientDetails = [
    sale.patient_age !== null ? `Age: ${sale.patient_age}` : "",
    sale.patient_gender ? `Gender: ${escapeHtml(sale.patient_gender)}` : "",
    sale.patient_phone ? `Phone: ${escapeHtml(sale.patient_phone)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  page.document
    .write(`<!doctype html><html><head><title>${escapeHtml(sale.invoice_no)}</title><style>
    body{font-family:Arial,sans-serif;max-width:410px;margin:24px auto;color:#102a5a}h1{font-size:19px;margin:0}h2{font-size:14px;letter-spacing:.08em;margin:8px 0;color:#198b35}p{margin:5px 0;color:#333}table{width:100%;border-collapse:collapse;margin-top:14px;color:#111}td{padding:9px 0;border-bottom:1px solid #ddd;vertical-align:top}.right{text-align:right;white-space:nowrap}small{color:#555}.row{display:flex;justify-content:space-between;gap:16px}.total{font-size:17px;font-weight:bold;border-top:2px solid #123;padding-top:8px}.muted{font-size:12px;color:#555}
  </style></head><body><h1>AL SHIFA FAMILY CLINIC</h1><p>Dr. Saqlain Abbas Chattha</p><h2>LABORATORY RECEIPT</h2><hr><p><strong>Lab invoice:</strong> ${escapeHtml(sale.invoice_no)}<br><strong>Date:</strong> ${escapeHtml(formatDateTime(sale.created_at))}<br><strong>Patient:</strong> ${escapeHtml(sale.patient_name)}</p>${patientDetails ? `<p class="muted">${patientDetails}</p>` : ""}${sale.referring_doctor ? `<p><strong>Referring doctor:</strong> ${escapeHtml(sale.referring_doctor)}</p>` : ""}<table>${rows}</table><p class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(sale.subtotal_paisa))}</span></p>${sale.discount_paisa ? `<p class="row"><span>Discount</span><span>-${escapeHtml(formatMoney(sale.discount_paisa))}</span></p>` : ""}<p class="row total"><span>Total</span><span>${escapeHtml(formatMoney(sale.total_paisa))}</span></p><p class="row"><span>Paid</span><span>${escapeHtml(formatMoney(sale.paid_paisa))}</span></p><p class="row"><span>Change</span><span>${escapeHtml(formatMoney(sale.change_paisa))}</span></p>${sale.note ? `<p><strong>Note:</strong> ${escapeHtml(sale.note)}</p>` : ""}<hr><p class="muted">This laboratory bill is separate from pharmacy medicine bills.</p><p class="muted">Software developed by Ahmad Uzair Tarar</p><script>window.onload=()=>window.print()</script></body></html>`);
  page.document.close();
}

export function LabInvoiceDialog({ sale }: { sale: LabInvoiceSale }) {
  const [open, setOpen] = useState(false);
  const balance = Math.max(sale.total_paisa - sale.paid_paisa, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="mr-1 size-4" /> View & print
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laboratory invoice {sale.invoice_no}</DialogTitle>
          <DialogDescription>
            {formatDateTime(sale.created_at)} · {sale.patient_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Patient:</span> {sale.patient_name}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {sale.patient_phone || "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Age / gender:</span>{" "}
              {[sale.patient_age, sale.patient_gender]
                .filter((value) => value !== null && value !== "")
                .join(" / ") || "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Referring doctor:</span>{" "}
              {sale.referring_doctor || "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Payment:</span>{" "}
              {titleCase(sale.payment_method)}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {titleCase(sale.status)}
            </p>
          </div>

          <div className="space-y-2 md:hidden">
            {sale.lab_sale_items.map((line) => (
              <div className="rounded-lg border p-3" key={line.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{line.test_name}</p>
                    <p className="text-xs text-muted-foreground">{line.category}</p>
                  </div>
                  <p className="font-medium">{formatMoney(line.line_total_paisa)}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {line.quantity} × {formatMoney(line.unit_price_paisa)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Test</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Quantity</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.lab_sale_items.map((line) => (
                  <tr className="border-t" key={line.id}>
                    <td className="p-3 font-medium">{line.test_name}</td>
                    <td className="p-3">{line.category}</td>
                    <td className="p-3 text-center">{line.quantity}</td>
                    <td className="p-3 text-right">{formatMoney(line.unit_price_paisa)}</td>
                    <td className="p-3 text-right">{formatMoney(line.line_total_paisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-sm space-y-1 rounded-lg border p-3">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(sale.subtotal_paisa)}</span>
            </p>
            {sale.discount_paisa > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatMoney(sale.discount_paisa)}</span>
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
              <span className="text-muted-foreground">Balance</span>
              <span>{formatMoney(balance)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Change</span>
              <span>{formatMoney(sale.change_paisa)}</span>
            </p>
          </div>
          {sale.note && (
            <p className="rounded-lg border p-3">
              <span className="font-medium">Note:</span> {sale.note}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={() => printLabReceipt(sale)}>
              <Printer className="mr-2 size-4" /> Print lab receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
