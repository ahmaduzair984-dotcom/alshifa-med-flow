import { useState } from "react";
import { DatabaseBackup } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/pharmacy";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function BackupButton() {
  const [saving, setSaving] = useState(false);

  const backup = async () => {
    setSaving(true);
    const [
      products,
      batches,
      patients,
      suppliers,
      sales,
      saleItems,
      purchases,
      purchaseItems,
      returns,
      returnItems,
      expenses,
      laboratory,
      settings,
    ] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("product_batches").select("*"),
      supabase.from("patients").select("*"),
      supabase.from("suppliers").select("*"),
      supabase.from("sales").select("*"),
      supabase.from("sale_items").select("*"),
      supabase.from("purchases").select("*"),
      supabase.from("purchase_items").select("*"),
      supabase.from("sale_returns").select("*"),
      supabase.from("return_items").select("*"),
      supabase.from("expenses").select("*"),
      supabase.rpc("lab_backup_data"),
      supabase.from("settings").select("*"),
    ]);
    setSaving(false);
    const failed = [
      products,
      batches,
      patients,
      suppliers,
      sales,
      saleItems,
      purchases,
      purchaseItems,
      returns,
      returnItems,
      expenses,
      laboratory,
      settings,
    ].find((result) => result.error);
    if (failed?.error) {
      toast.error(friendlyError(failed.error, "The backup could not be created."));
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(
      {
        exported_at: new Date().toISOString(),
        clinic: "Al Shifa Family Clinic",
        data: {
          products: products.data,
          product_batches: batches.data,
          patients: patients.data,
          suppliers: suppliers.data,
          sales: sales.data,
          sale_items: saleItems.data,
          purchases: purchases.data,
          purchase_items: purchaseItems.data,
          sale_returns: returns.data,
          return_items: returnItems.data,
          expenses: expenses.data,
          laboratory: laboratory.data,
          settings: settings.data,
        },
      },
      `al-shifa-clinic-backup-${date}.json`,
    );
    toast.success("Backup downloaded. Store it somewhere safe.");
  };

  return (
    <Button variant="outline" disabled={saving} onClick={backup}>
      <DatabaseBackup className="mr-2 size-4" />
      {saving ? "Preparing…" : "Download backup"}
    </Button>
  );
}
