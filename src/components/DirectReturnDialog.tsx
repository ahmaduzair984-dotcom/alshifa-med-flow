import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingRows } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, fromPaisa, toPaisa } from "@/lib/money";
import { friendlyError } from "@/lib/pharmacy";
import { isRetiredMedicine } from "@/lib/retired-medicines";

type Product = {
  id: string;
  brand_name: string;
  strength: string | null;
  base_unit: string;
  sale_price_paisa: number;
  cost_price_paisa: number;
};

type DirectReturnResult = {
  return_id: string;
  return_no: string;
  refund_paisa: number;
  cost_paisa: number;
  profit_adjustment_paisa: number;
};

export function DirectReturnDialog() {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [refundPerUnit, setRefundPerUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();

  const products = useQuery({
    queryKey: ["direct-return-products"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, brand_name, strength, base_unit, sale_price_paisa, cost_price_paisa")
        .eq("is_active", true)
        .order("brand_name")
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as Product[]).filter((product) => !isRetiredMedicine(product));
    },
  });

  const selectedProduct = useMemo(
    () => (products.data ?? []).find((product) => product.id === productId),
    [productId, products.data],
  );
  const matchingProducts = useMemo(() => {
    const query = medicineSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return (products.data ?? [])
      .filter((product) =>
        `${product.brand_name} ${product.strength ?? ""} ${product.base_unit}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .slice(0, 10);
  }, [medicineSearch, products.data]);
  const quantityNumber = Number(quantity);
  const refundUnitPaisa = toPaisa(refundPerUnit || "0");
  const refundTotal =
    Number.isInteger(quantityNumber) && quantityNumber > 0 ? refundUnitPaisa * quantityNumber : 0;

  const reset = () => {
    setProductId("");
    setMedicineSearch("");
    setShowSuggestions(false);
    setQuantity("1");
    setRefundPerUnit("");
  };

  const selectProduct = (product: Product) => {
    setProductId(product.id);
    setMedicineSearch(`${product.brand_name}${product.strength ? ` ${product.strength}` : ""}`);
    setRefundPerUnit(String(fromPaisa(product.sale_price_paisa)));
    setShowSuggestions(false);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Returns require an internet connection so stock and finances stay accurate.");
      return;
    }
    if (!selectedProduct) {
      toast.error("Select the medicine being returned.");
      return;
    }
    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      toast.error("Enter a valid whole-number quantity.");
      return;
    }
    if (refundUnitPaisa < 0) {
      toast.error("Refund amount cannot be negative.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSaving(true);
    const reason = String(form.get("reason") ?? "").trim();
    const { data, error } = await supabase.rpc("create_direct_return", {
      p_items: [
        {
          product_id: selectedProduct.id,
          quantity_base: quantityNumber,
          refund_paisa: refundTotal,
        },
      ],
      ...(reason ? { p_reason: reason } : {}),
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error, "The return could not be recorded."));
      return;
    }

    const result = data as unknown as DirectReturnResult;
    toast.success(
      `${result.return_no} recorded. Refund: ${formatMoney(result.refund_paisa)}. Stock and profit have been adjusted.`,
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
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return medicine</DialogTitle>
          <DialogDescription>
            No invoice is required. Select the medicine, enter the returned quantity, and confirm
            the amount being refunded.
          </DialogDescription>
        </DialogHeader>
        {products.isLoading ? (
          <LoadingRows rows={4} />
        ) : products.isError ? (
          <ErrorState message={friendlyError(products.error, "Medicines could not be loaded.")} />
        ) : (
          <form className="space-y-4" onSubmit={save}>
            <div>
              <Label htmlFor="direct-return-product-search">Search medicine</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="direct-return-product-search"
                  type="search"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions && medicineSearch.trim().length > 0}
                  aria-controls="direct-return-product-options"
                  placeholder="Type medicine name or strength..."
                  value={medicineSearch}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(event) => {
                    setMedicineSearch(event.target.value);
                    setProductId("");
                    setRefundPerUnit("");
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && showSuggestions && matchingProducts[0]) {
                      event.preventDefault();
                      selectProduct(matchingProducts[0]);
                    }
                  }}
                  className="pl-9"
                />
                {showSuggestions && medicineSearch.trim() ? (
                  <div
                    id="direct-return-product-options"
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
                  >
                    {matchingProducts.length ? (
                      matchingProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-start gap-2 rounded-sm px-3 py-3 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProduct(product)}
                        >
                          <Check
                            className={`mt-0.5 size-4 shrink-0 ${productId === product.id ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {product.brand_name}
                              {product.strength ? ` ${product.strength}` : ""}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatMoney(product.sale_price_paisa)} per {product.base_unit}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                        No matching medicine found.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              {selectedProduct ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <Check className="size-4" /> Selected: {selectedProduct.brand_name}
                  {selectedProduct.strength ? ` ${selectedProduct.strength}` : ""}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Start typing any letters to see matching medicines.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="direct-return-quantity">
                  Quantity{selectedProduct ? ` (${selectedProduct.base_unit})` : ""}
                </Label>
                <Input
                  id="direct-return-quantity"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="direct-return-refund">Refund per unit (Rs.)</Label>
                <Input
                  id="direct-return-refund"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={refundPerUnit}
                  onChange={(event) => setRefundPerUnit(event.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="direct-return-reason">Reason / note</Label>
              <Textarea
                id="direct-return-reason"
                name="reason"
                className="mt-1"
                placeholder="e.g. Patient returned sealed medicine"
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3 font-semibold">
                <span>Refund to patient</span>
                <span className="text-base">{formatMoney(refundTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The medicine is added back to stock. Reports subtract the refund and apply the
                returned buying cost to profit automatically.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={saving || !selectedProduct}>
              {saving ? "Recording return..." : "Record return & adjust stock"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
