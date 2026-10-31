import { Eye } from "lucide-react";

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
import { formatDate } from "@/lib/pharmacy";

export type PurchaseLine = {
  id: string;
  product_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_base: number;
  cost_price_paisa: number;
  line_total_paisa: number;
  base_unit: string;
};

export type PurchaseRecord = {
  id: string;
  purchase_date: string;
  reference: string | null;
  supplier: string;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  note: string | null;
  purchase_items: PurchaseLine[];
};

function purchaseLabel(purchase: PurchaseRecord) {
  return purchase.reference || `Purchase on ${formatDate(purchase.purchase_date)}`;
}

export function PurchaseDetailsDialog({ purchase }: { purchase: PurchaseRecord }) {
  const balance = Math.max(purchase.total_paisa - purchase.paid_paisa, 0);
  const visibleNote = purchase.note?.startsWith("offline-client:") ? null : purchase.note;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="mr-1 size-4" /> View details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchaseLabel(purchase)}</DialogTitle>
          <DialogDescription>
            Medicines, quantities, buying prices, and payment details for this purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Purchase date:</span>{" "}
            {formatDate(purchase.purchase_date)}
          </p>
          <p>
            <span className="text-muted-foreground">Supplier:</span> {purchase.supplier}
          </p>
          <p>
            <span className="text-muted-foreground">Reference:</span>{" "}
            {purchase.reference || "Not entered"}
          </p>
        </div>

        {purchase.purchase_items.length ? (
          <>
            <div className="divide-y rounded-lg border md:hidden">
              {purchase.purchase_items.map((line) => (
                <div className="space-y-2 p-3 text-sm" key={line.id}>
                  <p className="font-semibold">{line.product_name}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity bought</p>
                      <p>
                        {line.quantity_base} {line.base_unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Buying price / unit</p>
                      <p>{formatMoney(line.cost_price_paisa)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Batch</p>
                      <p>{line.batch_number || "Not entered"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expiry</p>
                      <p>{line.expiry_date ? formatDate(line.expiry_date) : "Not entered"}</p>
                    </div>
                  </div>
                  <p className="flex justify-between border-t pt-2 font-medium">
                    <span>Line total</span>
                    <span>{formatMoney(line.line_total_paisa)}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3">Medicine</th>
                    <th className="p-3">Batch / expiry</th>
                    <th className="p-3 text-center">Quantity bought</th>
                    <th className="p-3 text-right">Buying price / unit</th>
                    <th className="p-3 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.purchase_items.map((line) => (
                    <tr className="border-t" key={line.id}>
                      <td className="p-3 font-medium">{line.product_name}</td>
                      <td className="p-3">
                        <p>{line.batch_number || "No batch number"}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.expiry_date
                            ? `Expires ${formatDate(line.expiry_date)}`
                            : "No expiry date"}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        {line.quantity_base} {line.base_unit}
                      </td>
                      <td className="p-3 text-right">{formatMoney(line.cost_price_paisa)}</td>
                      <td className="p-3 text-right font-medium">
                        {formatMoney(line.line_total_paisa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            No medicine details are available for this historical purchase.
          </p>
        )}

        <div className="ml-auto w-full max-w-sm space-y-1 rounded-lg border p-3 text-sm">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(purchase.subtotal_paisa)}</span>
          </p>
          {purchase.discount_paisa > 0 && (
            <p className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatMoney(purchase.discount_paisa)}</span>
            </p>
          )}
          <p className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total purchase</span>
            <span>{formatMoney(purchase.total_paisa)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Amount paid</span>
            <span>{formatMoney(purchase.paid_paisa)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span>{formatMoney(balance)}</span>
          </p>
        </div>

        {visibleNote && (
          <p className="rounded-lg border p-3 text-sm">
            <span className="font-medium">Note:</span> {visibleNote}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
