import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ErrorState, LoadingRows } from "@/components/ui-kit";
import { friendlyError } from "@/lib/pharmacy";
import { isRetiredMedicine } from "@/lib/retired-medicines";

type Batch = {
  id: string;
  batch_number: string;
  quantity_base: number;
  products: { brand_name: string; strength: string | null; base_unit: string } | null;
};

export function StockAdjustmentDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const batches = useQuery({
    queryKey: ["stock-adjustment-batches"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("id, batch_number, quantity_base, products(brand_name, strength, base_unit)")
        .gt("quantity_base", 0)
        .order("expiry_date", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data as unknown as Batch[];
    },
  });
  const available = useMemo(
    () => (batches.data ?? []).filter((batch) => !isRetiredMedicine(batch.products ?? {})),
    [batches.data],
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Manual stock adjustments require an internet connection.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const batchId = String(form.get("batch_id") ?? "");
    const change = Number(form.get("change") ?? 0);
    if (!batchId) {
      toast.error("Choose a medicine batch.");
      return;
    }
    if (!Number.isInteger(change) || change === 0) {
      toast.error("Enter a whole number to add or remove stock.");
      return;
    }
    setSaving(true);
    const note = String(form.get("note") ?? "").trim();
    const { error } = await supabase.rpc("adjust_stock", {
      p_batch_id: batchId,
      p_change: change,
      p_reason: String(form.get("reason") ?? "adjustment") as
        "damage" | "expired" | "adjustment" | "correction",
      ...(note ? { p_note: note } : {}),
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Stock adjusted and recorded in the audit trail.");
    setOpen(false);
    await client.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal className="mr-2 size-4" /> Adjust stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Use a positive number to add stock or a negative number to remove it. Every change is
            logged.
          </DialogDescription>
        </DialogHeader>
        {batches.isLoading ? (
          <LoadingRows rows={3} />
        ) : batches.isError ? (
          <ErrorState message={friendlyError(batches.error)} />
        ) : (
          <form className="space-y-3" onSubmit={save}>
            <div>
              <Label htmlFor="adjustment-batch">Medicine batch</Label>
              <SearchableSelect
                id="adjustment-batch"
                name="batch_id"
                placeholder="Select or search medicine batch"
                searchPlaceholder="Type medicine, strength, or batch..."
                emptyMessage="No available medicine batch matches your search."
                disabled={!available.length}
                options={available.map((batch) => {
                  const medicine = batch.products?.brand_name ?? "Medicine";
                  const strength = batch.products?.strength ?? "";
                  const unit = batch.products?.base_unit ?? "units";
                  return {
                    value: batch.id,
                    label: `${medicine}${strength ? ` ${strength}` : ""} — Batch ${batch.batch_number} (${batch.quantity_base} ${unit})`,
                    searchText: `${medicine} ${strength} ${batch.batch_number} ${unit}`,
                  };
                })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="adjustment-change">Quantity change</Label>
                <Input
                  id="adjustment-change"
                  name="change"
                  type="number"
                  step="1"
                  placeholder="e.g. -2"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="adjustment-reason">Reason</Label>
                <select
                  id="adjustment-reason"
                  name="reason"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue="adjustment"
                >
                  <option value="adjustment">Stock count adjustment</option>
                  <option value="damage">Damaged medicine</option>
                  <option value="expired">Expired medicine</option>
                  <option value="correction">Data correction</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="adjustment-note">Note</Label>
              <Textarea
                id="adjustment-note"
                name="note"
                className="mt-1"
                placeholder="Why is this change needed?"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !available.length}>
                {saving ? "Saving…" : "Save adjustment"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
