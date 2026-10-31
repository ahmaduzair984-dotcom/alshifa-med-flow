import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Minus, Plus, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, LoadingRows } from "@/components/ui-kit";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatMoney, toPaisa } from "@/lib/money";
import { friendlyError } from "@/lib/pharmacy";
import { cachedQuery, runOrQueueMutation } from "@/lib/offline-queue";
import { isRetiredMedicine } from "@/lib/retired-medicines";

export const Route = createFileRoute("/_authenticated/pos")({ component: Pos });

type Product = {
  id: string;
  brand_name: string;
  strength: string | null;
  base_unit: string;
  sale_price_paisa: number;
  min_stock: number;
  sellable_base: number;
};
type Patient = { id: string; name: string; phone: string | null; code: string };
type CartLine = Product & { quantity: number };
type Receipt = {
  invoiceNo: string;
  createdAt: string;
  patientName: string;
  paymentMethod: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  procedureName: string;
  procedureCharge: number;
  total: number;
  paid: number;
  change: number;
  pending?: boolean;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character,
  );
}

function printReceipt(receipt: Receipt) {
  const page = window.open("", "al-shifa-receipt", "width=420,height=700");
  if (!page) {
    toast.error("Please allow pop-ups to print the receipt.");
    return;
  }
  const lines = receipt.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.brand_name)}${line.strength ? ` ${escapeHtml(line.strength)}` : ""}<br><small>${line.quantity} × ${formatMoney(line.sale_price_paisa)}</small></td><td style="text-align:right">${formatMoney(line.sale_price_paisa * line.quantity)}</td></tr>`,
    )
    .join("");
  const procedureLine =
    receipt.procedureName && receipt.procedureCharge > 0
      ? `<tr><td><strong>${escapeHtml(receipt.procedureName)}</strong><br><small>Procedure</small></td><td style="text-align:right">${formatMoney(receipt.procedureCharge)}</td></tr>`
      : "";
  const pendingNotice = receipt.pending
    ? '<p class="pending">PENDING SYNC — final invoice number will be assigned when online.</p>'
    : "";
  page.document.write(
    `<!doctype html><html><head><title>${escapeHtml(receipt.invoiceNo)}</title><style>body{font-family:Arial,sans-serif;max-width:360px;margin:24px auto;color:#102a5a}h1{font-size:19px;margin:0}p{margin:5px 0;color:#333}table{width:100%;border-collapse:collapse;margin-top:14px;color:#111}td{padding:8px 0;border-bottom:1px solid #ddd}small{color:#555}.total{font-size:17px;font-weight:bold}.muted{font-size:12px;color:#555}.pending{border:1px solid #d99b16;background:#fff8df;padding:8px;font-weight:bold}</style></head><body><h1>AL SHIFA FAMILY CLINIC</h1><p>Dr. Saqlain Abbas Chattha</p>${pendingNotice}<hr><p><strong>Receipt:</strong> ${escapeHtml(receipt.invoiceNo)}<br><strong>Date:</strong> ${escapeHtml(new Date(receipt.createdAt).toLocaleString("en-GB"))}<br><strong>Patient:</strong> ${escapeHtml(receipt.patientName)}<br><strong>Payment:</strong> ${escapeHtml(receipt.paymentMethod)}</p><table>${lines}${procedureLine}</table><p>Subtotal <span style="float:right">${formatMoney(receipt.subtotal)}</span></p>${receipt.discount ? `<p>Discount <span style="float:right">-${formatMoney(receipt.discount)}</span></p>` : ""}${receipt.serviceCharge ? `<p>Other service charges <span style="float:right">${formatMoney(receipt.serviceCharge)}</span></p>` : ""}<p class="total">Total <span style="float:right">${formatMoney(receipt.total)}</span></p><p>Paid <span style="float:right">${formatMoney(receipt.paid)}</span></p><p>Change <span style="float:right">${formatMoney(receipt.change)}</span></p><hr><p class="muted">Thank you for choosing Al Shifa Family Clinic.</p><p class="muted">Software developed by Ahmad Uzair Tarar</p><script>window.onload=()=>window.print()</script></body></html>`,
  );
  page.document.close();
}

function Pos() {
  const [search, setSearch] = useState("");
  const [medicineListOpen, setMedicineListOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [procedureCharge, setProcedureCharge] = useState("");
  const [patientId, setPatientId] = useState("");
  const [quickPatientName, setQuickPatientName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const client = useQueryClient();
  const products = useQuery({
    queryKey: ["pos-products"],
    queryFn: () =>
      cachedQuery("pos-products-with-stock-v2", async () => {
        const [productsResult, stockResult] = await Promise.all([
          supabase
            .from("products")
            .select("id, brand_name, strength, base_unit, sale_price_paisa, min_stock")
            .eq("is_active", true)
            .order("brand_name")
            .limit(1000),
          supabase.from("product_stock").select("product_id, sellable_base"),
        ]);
        if (productsResult.error) throw productsResult.error;
        if (stockResult.error) throw stockResult.error;
        const stockByProduct = new Map(
          (stockResult.data ?? []).map((row) => [row.product_id, row.sellable_base ?? 0]),
        );
        return (productsResult.data ?? []).map((product) => ({
          ...product,
          sellable_base: stockByProduct.get(product.id) ?? 0,
        })) as Product[];
      }),
  });
  const patients = useQuery({
    queryKey: ["pos-patients"],
    queryFn: () =>
      cachedQuery("pos-patients", async () => {
        const { data, error } = await supabase
          .from("patients")
          .select("id, name, phone, code")
          .order("name")
          .limit(1000);
        if (error) throw error;
        return data as Patient[];
      }),
  });
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (product) =>
        !isRetiredMedicine(product) &&
        (!term || `${product.brand_name} ${product.strength ?? ""}`.toLowerCase().includes(term)),
    );
  }, [products.data, search]);
  const hasMedicineSearch = search.trim().length > 0;
  const medicineResultsVisible = hasMedicineSearch || medicineListOpen;
  const displayedMedicines = hasMedicineSearch ? matches.slice(0, 8) : matches;
  const medicineSubtotal = cart.reduce(
    (sum, line) => sum + line.sale_price_paisa * line.quantity,
    0,
  );
  const enteredProcedureName = procedureName.trim();
  const procedureChargePaisa = Math.max(toPaisa(procedureCharge || "0"), 0);
  const hasProcedure = Boolean(enteredProcedureName) && procedureChargePaisa > 0;
  const hasProcedureEntry = Boolean(enteredProcedureName || procedureCharge.trim());
  const subtotal = medicineSubtotal + (hasProcedure ? procedureChargePaisa : 0);
  const discountPaisa = Math.max(toPaisa(discount || "0"), 0);
  const serviceChargePaisa = Math.max(toPaisa(serviceCharge || "0"), 0);
  const total = Math.max(subtotal - discountPaisa, 0) + serviceChargePaisa;
  const paidPaisa = toPaisa(paid || "0");
  const chosenPatient = (patients.data ?? []).find((patient) => patient.id === patientId);
  const quantityInCart = (productId: string) =>
    cart.find((line) => line.id === productId)?.quantity ?? 0;
  const remainingStock = (product: Product) =>
    Math.max(product.sellable_base - quantityInCart(product.id), 0);
  const stockLabel = (product: Product) => {
    const remaining = remainingStock(product);
    const unit = `${product.base_unit}${remaining === 1 ? "" : "s"}`;
    if (remaining === 0) return "Out of stock";
    if (remaining <= product.min_stock) return `Low stock · ${remaining} ${unit} left`;
    return `${remaining} ${unit} left`;
  };
  const add = (product: Product) => {
    if (remainingStock(product) <= 0) {
      toast.error(`${product.brand_name} has no more saleable stock available.`);
      return;
    }
    setCart((current) => {
      const found = current.find((line) => line.id === product.id);
      return found
        ? current.map((line) =>
            line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { ...product, quantity: 1 }];
    });
    setSearch("");
    setMedicineListOpen(false);
  };
  const adjust = (id: string, delta: number) => {
    const line = cart.find((item) => item.id === id);
    if (line && delta > 0 && line.quantity >= line.sellable_base) {
      toast.error(
        `Only ${line.sellable_base} ${line.base_unit}${line.sellable_base === 1 ? "" : "s"} are available.`,
      );
      return;
    }
    setCart((current) =>
      current.flatMap((line) =>
        line.id !== id
          ? [line]
          : line.quantity + delta > 0
            ? [{ ...line, quantity: line.quantity + delta }]
            : [],
      ),
    );
  };
  const complete = async () => {
    if (!cart.length && !hasProcedureEntry) {
      toast.error("Add at least one medicine or procedure.");
      return;
    }
    if (hasProcedureEntry && !enteredProcedureName) {
      toast.error("Enter the procedure name.");
      return;
    }
    if (hasProcedureEntry && procedureChargePaisa <= 0) {
      toast.error("Enter a procedure charge greater than zero.");
      return;
    }
    if (discountPaisa > subtotal) {
      toast.error("Discount cannot be more than the subtotal.");
      return;
    }
    if (paidPaisa < 0) {
      toast.error("Amount paid cannot be negative.");
      return;
    }
    const actualPaid = paid.trim() ? paidPaisa : total;
    const enteredPatientName = quickPatientName.trim();
    let salePatientId = patientId;
    let salePatientName = chosenPatient?.name || enteredPatientName || "Walk-in customer";
    setSaving(true);
    if (!salePatientId && enteredPatientName) {
      salePatientId = crypto.randomUUID();
      const patientResult = await runOrQueueMutation({
        kind: "insert_patient",
        label: `Quick patient: ${enteredPatientName}`,
        payload: {
          id: salePatientId,
          name: enteredPatientName,
        },
      });
      if (patientResult.error) {
        setSaving(false);
        toast.error(friendlyError(patientResult.error, "The patient name could not be saved."));
        return;
      }
      salePatientName = enteredPatientName;
    }
    const clientToken = crypto.randomUUID();
    const payload = {
      p_items: cart.map((line) => ({
        product_id: line.id,
        quantity: line.quantity,
        units_per_sale_unit: 1,
        unit_label: line.base_unit,
      })),
      p_services: hasProcedure
        ? [
            {
              service_name: enteredProcedureName,
              category: "Procedure",
              quantity: 1,
              unit_price_paisa: procedureChargePaisa,
              unit_cost_paisa: 0,
            },
          ]
        : [],
      p_patient_id: salePatientId || undefined,
      p_discount_paisa: discountPaisa,
      p_service_charge_paisa: serviceChargePaisa,
      p_paid_paisa: actualPaid,
      p_payment_method: paymentMethod,
      p_client_token: clientToken,
    };
    const result = await runOrQueueMutation({
      kind: "create_sale",
      label: `Sale for ${salePatientName}`,
      payload,
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    const serverResult = result.data as {
      invoice_no?: string;
      subtotal_paisa?: number;
      discount_paisa?: number;
      service_charge_paisa?: number;
      total_paisa?: number;
      paid_paisa?: number;
      change_paisa?: number;
    } | null;
    const savedTotal = serverResult?.total_paisa ?? total;
    const pendingNumber = `PENDING-${clientToken.slice(0, 8).toUpperCase()}`;
    setReceipt({
      invoiceNo: result.queued ? pendingNumber : (serverResult?.invoice_no ?? "Sale receipt"),
      createdAt: new Date().toISOString(),
      patientName: salePatientName,
      paymentMethod,
      lines: cart,
      subtotal: serverResult?.subtotal_paisa ?? subtotal,
      discount: serverResult?.discount_paisa ?? discountPaisa,
      serviceCharge: serverResult?.service_charge_paisa ?? serviceChargePaisa,
      procedureName: enteredProcedureName,
      procedureCharge: hasProcedure ? procedureChargePaisa : 0,
      total: savedTotal,
      paid: serverResult?.paid_paisa ?? actualPaid,
      change: serverResult?.change_paisa ?? Math.max(actualPaid - savedTotal, 0),
      pending: result.queued,
    });
    toast.success(
      result.queued
        ? "Sale saved offline. It is provisional and will synchronize automatically when online."
        : `Sale ${serverResult?.invoice_no ?? ""} completed.`,
    );
    setCart([]);
    setPaid("");
    setDiscount("");
    setServiceCharge("");
    setProcedureName("");
    setProcedureCharge("");
    setPatientId("");
    setQuickPatientName("");
    if (!result.queued) await client.invalidateQueries();
  };
  return (
    <div>
      <PageHeader
        title="New Sale"
        description="Choose a patient if needed, add medicines and complete the sale. Stock is allocated automatically."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_410px]">
        <div className="grid min-w-0 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Medicines</CardTitle>
                {hasMedicineSearch ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setMedicineListOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-expanded={medicineListOpen}
                    aria-controls="sale-medicine-results"
                    onClick={() => setMedicineListOpen((open) => !open)}
                  >
                    {medicineListOpen ? (
                      <ChevronUp className="mr-1 size-4" />
                    ) : (
                      <ChevronDown className="mr-1 size-4" />
                    )}
                    {medicineListOpen ? "Fold list" : "Browse all"}
                  </Button>
                )}
              </div>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Type a medicine name for suggestions"
                autoComplete="off"
              />
            </CardHeader>
            <CardContent>
              {products.isLoading ? (
                <LoadingRows />
              ) : products.isError ? (
                <EmptyState
                  title="Medicine list unavailable offline"
                  description="Open the New Sale page once while online to save the medicine list on this device."
                />
              ) : medicineResultsVisible && displayedMedicines.length ? (
                <div id="sale-medicine-results">
                  {hasMedicineSearch && matches.length > displayedMedicines.length && (
                    <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
                      Showing the first {displayedMedicines.length} of {matches.length} suggestions.
                      Type more letters to narrow the list.
                    </p>
                  )}
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {displayedMedicines.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => add(product)}
                        disabled={remainingStock(product) === 0}
                        className="rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-70"
                      >
                        <p className="font-medium">
                          {product.brand_name} {product.strength ?? ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {product.base_unit} · {formatMoney(product.sale_price_paisa)}
                        </p>
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            remainingStock(product) === 0
                              ? "text-destructive"
                              : remainingStock(product) <= product.min_stock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {stockLabel(product)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : medicineResultsVisible ? (
                <EmptyState title="No medicines found" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Start typing above for quick suggestions, or tap Browse all. The list folds again
                  after you select a medicine.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5" /> Current cart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length ? (
              <>
                {cart.map((line) => (
                  <div key={line.id} className="border-b pb-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{line.brand_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(line.sale_price_paisa)} each
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button size="icon" variant="outline" onClick={() => adjust(line.id, -1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{line.quantity}</span>
                      <Button size="icon" variant="outline" onClick={() => adjust(line.id, 1)}>
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setCart((current) => current.filter((item) => item.id !== line.id))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState title="Cart is empty" description="Select a medicine to begin." />
            )}
            <div className="space-y-3 border-t pt-3">
              <div>
                <label className="text-sm font-medium" htmlFor="sale-patient">
                  Existing patient (optional)
                </label>
                <SearchableSelect
                  id="sale-patient"
                  name="patient_id"
                  value={patientId}
                  placeholder="Walk-in customer — search patients"
                  searchPlaceholder="Search by patient name, phone, or code..."
                  emptyMessage="No patient matches your search."
                  options={[
                    { value: "", label: "Walk-in customer", searchText: "walk in" },
                    ...(patients.data ?? []).map((patient) => ({
                      value: patient.id,
                      label: `${patient.name}${patient.phone ? ` — ${patient.phone}` : ""}`,
                      searchText: `${patient.name} ${patient.phone ?? ""} ${patient.code ?? ""}`,
                    })),
                  ]}
                  onValueChange={(value) => {
                    setPatientId(value);
                    if (value) setQuickPatientName("");
                  }}
                />
                <Link className="mt-1 inline-block text-xs text-primary underline" to="/patients">
                  Add a patient
                </Link>
              </div>
              {!patientId && (
                <div>
                  <label className="text-sm font-medium" htmlFor="quick-patient-name">
                    Quick patient name{" "}
                    <span className="font-normal text-muted-foreground">(recommended)</span>
                  </label>
                  <Input
                    id="quick-patient-name"
                    value={quickPatientName}
                    onChange={(event) => setQuickPatientName(event.target.value)}
                    placeholder="Enter name without opening the Patients page"
                    autoComplete="off"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    This saves the name with the invoice so the sale can be found later.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Discount (Rs.)
                  <Input
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    inputMode="decimal"
                    min="0"
                    placeholder="0.00"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Other service charges (Rs.)
                  <Input
                    value={serviceCharge}
                    onChange={(event) => setServiceCharge(event.target.value)}
                    inputMode="decimal"
                    min="0"
                    placeholder="0.00"
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-medium">Procedure (optional)</p>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                  <label className="text-sm">
                    Procedure name
                    <Input
                      value={procedureName}
                      onChange={(event) => setProcedureName(event.target.value)}
                      placeholder="e.g. Dressing or nebulization"
                      autoComplete="off"
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm">
                    Charge (Rs.)
                    <Input
                      value={procedureCharge}
                      onChange={(event) => setProcedureCharge(event.target.value)}
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The procedure name and charge will appear separately on the invoice.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Payment method
                  <select
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm">
                  Amount paid
                  <Input
                    value={paid}
                    onChange={(event) => setPaid(event.target.value)}
                    inputMode="decimal"
                    min="0"
                    placeholder={total ? (total / 100).toFixed(2) : "0"}
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medicines</span>
                  <span>{formatMoney(medicineSubtotal)}</span>
                </div>
                {hasProcedure && (
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0 break-words text-muted-foreground">
                      {enteredProcedureName}
                    </span>
                    <span className="shrink-0">{formatMoney(procedureChargePaisa)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatMoney(discountPaisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other service charges</span>
                  <span>{formatMoney(serviceChargePaisa)}</span>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Change: {formatMoney(Math.max((paid.trim() ? paidPaisa : total) - total, 0))}
              </p>
              <Button
                className="w-full"
                disabled={(!cart.length && !hasProcedureEntry) || saving}
                onClick={complete}
              >
                {saving ? "Completing…" : "Complete sale"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{receipt?.pending ? "Sale saved offline" : "Sale completed"}</DialogTitle>
            <DialogDescription>
              {receipt?.pending
                ? "This provisional sale is stored on this device. The final invoice number and stock update will be confirmed after synchronization."
                : `Receipt ${receipt?.invoiceNo} is ready to print.`}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>Patient:</strong> {receipt.patientName}
              </p>
              {receipt.lines.length > 0 && (
                <div className="space-y-1 rounded-md border p-3">
                  {receipt.lines.map((line) => (
                    <p className="flex justify-between gap-3" key={line.id}>
                      <span>
                        {line.brand_name} × {line.quantity}
                      </span>
                      <span>{formatMoney(line.sale_price_paisa * line.quantity)}</span>
                    </p>
                  ))}
                </div>
              )}
              {receipt.procedureName && receipt.procedureCharge > 0 && (
                <div className="rounded-md border p-3">
                  <p className="flex justify-between gap-3">
                    <span>
                      {receipt.procedureName}
                      <span className="block text-xs text-muted-foreground">Procedure</span>
                    </span>
                    <span>{formatMoney(receipt.procedureCharge)}</span>
                  </p>
                </div>
              )}
              <div className="rounded-md border p-3">
                <p className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(receipt.subtotal)}</span>
                </p>
                {receipt.discount > 0 && (
                  <p className="flex justify-between">
                    <span>Discount</span>
                    <span>-{formatMoney(receipt.discount)}</span>
                  </p>
                )}
                {receipt.serviceCharge > 0 && (
                  <p className="flex justify-between">
                    <span>Other service charges</span>
                    <span>{formatMoney(receipt.serviceCharge)}</span>
                  </p>
                )}
                <p className="mt-1 flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(receipt.total)}</span>
                </p>
              </div>
              <p>
                <strong>Paid:</strong> {formatMoney(receipt.paid)} · <strong>Change:</strong>{" "}
                {formatMoney(receipt.change)}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceipt(null)}>
                  Close
                </Button>
                <Button onClick={() => printReceipt(receipt)}>
                  <Printer className="mr-2 size-4" /> Print receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
