import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Batch = Database["public"]["Tables"]["product_batches"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export type SaleUnitOption = {
  label: string;
  multiplier: number;
};

/** Available selling units for a product, from largest to base unit. */
export function saleUnits(product: Pick<Product,
  "base_unit" | "pack_unit" | "units_per_pack" | "carton_unit" | "packs_per_carton">): SaleUnitOption[] {
  const units: SaleUnitOption[] = [{ label: product.base_unit, multiplier: 1 }];
  if (product.pack_unit && product.units_per_pack > 1) {
    units.push({ label: product.pack_unit, multiplier: product.units_per_pack });
  }
  if (product.carton_unit && product.packs_per_carton > 1 && product.units_per_pack > 1) {
    units.push({
      label: product.carton_unit,
      multiplier: product.units_per_pack * product.packs_per_carton,
    });
  }
  return units;
}

/** Human readable stock, e.g. "12 Strips + 4 Tablets". */
export function describeStock(
  base: number,
  product: Pick<Product, "base_unit" | "pack_unit" | "units_per_pack">,
): string {
  if (!product.pack_unit || product.units_per_pack <= 1) {
    return `${base} ${product.base_unit}${base === 1 ? "" : "s"}`;
  }
  const packs = Math.floor(base / product.units_per_pack);
  const rest = base % product.units_per_pack;
  const parts: string[] = [];
  if (packs > 0) parts.push(`${packs} ${product.pack_unit}${packs === 1 ? "" : "s"}`);
  if (rest > 0 || packs === 0) parts.push(`${rest} ${product.base_unit}${rest === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

export type ExpiryState = "expired" | "critical" | "soon" | "ok" | "none";

export function expiryState(date: string | null, warningDays = 90): ExpiryState {
  if (!date) return "none";
  const days = daysUntil(date);
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= warningDays) return "soon";
  return "ok";
}

export function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Turns a raw database error into a message that is safe and useful for staff. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  if (!message) return fallback;
  if (/duplicate key|unique constraint/i.test(message)) {
    if (/barcode/i.test(message)) return "A medicine with this barcode already exists.";
    if (/batch/i.test(message)) return "This batch number already exists for the medicine.";
    return "This record already exists.";
  }
  if (/violates row-level security|permission denied|not allowed/i.test(message)) {
    return "You do not have permission to do this.";
  }
  if (/check constraint|violates check/i.test(message)) {
    return "Some values are not valid. Please review the form.";
  }
  if (/foreign key/i.test(message)) {
    return "This record is linked to other data and cannot be changed.";
  }
  // Messages raised deliberately by our database business logic are already friendly.
  return message.replace(/^.*?:\s*/, "").slice(0, 220) || fallback;
}
