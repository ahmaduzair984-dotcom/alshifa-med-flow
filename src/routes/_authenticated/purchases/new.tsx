import { useState, type ComponentProps, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { PageHeader, ErrorState, LoadingRows } from "@/components/ui-kit";
import { friendlyError } from "@/lib/pharmacy";
import { toPaisa } from "@/lib/money";
import { cachedQuery, runOrQueueMutation } from "@/lib/offline-queue";
import { isRetiredMedicine } from "@/lib/retired-medicines";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  component: NewPurchase,
});

function NewPurchase() {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const products = useQuery({
    queryKey: ["purchase-products"],
    queryFn: async () =>
      (
        await cachedQuery("purchase-products", async () => {
          const { data, error } = await supabase
            .from("products")
            .select("id, brand_name, strength, base_unit")
            .eq("is_active", true)
            .order("brand_name");
          if (error) throw error;
          return data;
        })
      ).filter((medicine) => !isRetiredMedicine(medicine)),
  });
  const suppliers = useQuery({
    queryKey: ["purchase-suppliers"],
    queryFn: () =>
      cachedQuery("purchase-suppliers", async () => {
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, company")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data;
      }),
  });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("product_id") ?? "");
    const quantity = Number(form.get("quantity") ?? 0);
    const cost = toPaisa(String(form.get("cost_price") ?? "0"));
    const sale = toPaisa(String(form.get("sale_price") ?? "0"));

    if (!productId || quantity <= 0 || cost < 0 || sale < 0) {
      toast.error("Choose a medicine and enter valid quantity and prices.");
      return;
    }

    setSaving(true);
    const payload = {
      p_supplier_id: String(form.get("supplier_id") || "") || undefined,
      p_reference: String(form.get("reference") || "").trim() || undefined,
      p_purchase_date: String(form.get("purchase_date") || "") || undefined,
      p_paid_paisa: toPaisa(String(form.get("paid") || "0")),
      p_note: `offline-client:${crypto.randomUUID()}`,
      p_items: [
        {
          product_id: productId,
          batch_number: String(form.get("batch_number") || "").trim(),
          expiry_date: String(form.get("expiry_date") || ""),
          quantity_base: quantity,
          cost_price_paisa: cost,
          sale_price_paisa: sale,
        },
      ],
    };
    const result = await runOrQueueMutation({
      kind: "create_purchase",
      label: "Incoming stock purchase",
      payload,
    });
    setSaving(false);

    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }

    toast.success(
      result.queued
        ? "Purchase saved offline. Stock will be added after automatic synchronization."
        : "Purchase recorded and stock added.",
    );
    event.currentTarget.reset();
    if (!result.queued) await client.invalidateQueries();
  };

  return (
    <div>
      <PageHeader
        title="New Purchase"
        description="Record incoming stock. A batch number is optional, and the app will assign an internal reference when it is unavailable."
        actions={
          <Button asChild variant="outline">
            <Link to="/medicines">Add a new medicine</Link>
          </Button>
        }
      />
      {products.isLoading || suppliers.isLoading ? (
        <LoadingRows />
      ) : products.isError || suppliers.isError ? (
        <ErrorState message="Purchase lists are not available offline yet. Open this page once while online to save them on this device." />
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Add stock</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div>
                <Label htmlFor="product_id">Medicine</Label>
                <SearchableSelect
                  id="product_id"
                  name="product_id"
                  placeholder="Select or search medicine"
                  searchPlaceholder="Type medicine name or strength..."
                  emptyMessage="No medicine matches your search."
                  options={(products.data ?? []).map((product) => ({
                    value: product.id,
                    label: `${product.brand_name}${product.strength ? ` ${product.strength}` : ""} (${product.base_unit})`,
                    searchText: `${product.brand_name} ${product.strength ?? ""} ${product.base_unit}`,
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="supplier_id">Supplier</Label>
                <select
                  id="supplier_id"
                  name="supplier_id"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No supplier selected</option>
                  {suppliers.data?.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                      {supplier.company ? ` - ${supplier.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Batch number (optional)"
                name="batch_number"
                placeholder="Leave blank if unavailable"
              />
              <Field label="Expiry date" name="expiry_date" type="date" />
              <Field label="Quantity (base units)" name="quantity" type="number" min="1" required />
              <Field
                label="Cost per unit (Rs.)"
                name="cost_price"
                type="number"
                step="0.01"
                min="0"
                required
              />
              <Field
                label="Selling price per unit (Rs.)"
                name="sale_price"
                type="number"
                step="0.01"
                min="0"
                required
              />
              <Field label="Supplier invoice / reference" name="reference" />
              <Field
                label="Purchase date"
                name="purchase_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <Field
                label="Amount paid (Rs.)"
                name="paid"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
              />
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save purchase & add stock"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="mt-1" {...props} />
    </div>
  );
}
