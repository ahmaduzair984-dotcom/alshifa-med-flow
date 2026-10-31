import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FlaskConical,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/ui-kit";
import { SearchableSelect } from "@/components/SearchableSelect";
import { printLabReceipt, type LabInvoiceSale } from "@/components/LabInvoiceDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, toPaisa } from "@/lib/money";
import { cachedQuery, runOrQueueMutation } from "@/lib/offline-queue";
import { friendlyError } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/labs/new")({ component: NewLabSale });

type LabTest = {
  id: string;
  name: string;
  category: string;
  price_paisa: number;
  sort_order: number;
};

type Patient = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
};

type CartLine = LabTest & { quantity: number };

const STEPS = [
  { number: 1, label: "Patient" },
  { number: 2, label: "Lab details" },
  { number: 3, label: "Review" },
] as const;

function NewLabSale() {
  const { can } = useAuth();
  const client = useQueryClient();
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<LabInvoiceSale | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState(false);

  const tests = useQuery({
    queryKey: ["lab-sale-tests"],
    queryFn: () =>
      cachedQuery("lab-sale-tests-v1", async () => {
        const { data, error } = await supabase
          .from("lab_tests")
          .select("id, name, category, price_paisa, sort_order")
          .eq("is_active", true)
          .order("sort_order")
          .order("name")
          .limit(1000);
        if (error) throw error;
        return data as LabTest[];
      }),
  });

  const patients = useQuery({
    queryKey: ["lab-sale-patients"],
    queryFn: () =>
      cachedQuery("lab-sale-patients-v1", async () => {
        const { data, error } = await supabase
          .from("patients")
          .select("id, code, name, phone, age, gender")
          .order("name")
          .limit(1000);
        if (error) throw error;
        return data as Patient[];
      }),
  });

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tests.data ?? []).filter(
      (test) => !term || `${test.name} ${test.category}`.toLowerCase().includes(term),
    );
  }, [search, tests.data]);
  const visibleTests = search.trim() ? matches.slice(0, 12) : matches;
  const subtotal = cart.reduce((sum, line) => sum + line.price_paisa * line.quantity, 0);
  const discountPaisa = Math.max(toPaisa(discount || "0"), 0);
  const total = Math.max(subtotal - discountPaisa, 0);
  const paidPaisa = toPaisa(paid || "0");
  const actualPaid = paid.trim() ? paidPaisa : total;
  const balance = Math.max(total - actualPaid, 0);
  const change = Math.max(actualPaid - total, 0);

  const selectPatient = (value: string) => {
    setPatientId(value);
    const patient = (patients.data ?? []).find((item) => item.id === value);
    if (patient) {
      setPatientName(patient.name);
      setPatientAge(patient.age === null ? "" : String(patient.age));
      setPatientGender(patient.gender ?? "");
      setPatientPhone(patient.phone ?? "");
    } else {
      setPatientName("");
      setPatientAge("");
      setPatientGender("");
      setPatientPhone("");
    }
  };

  const patientError = () => {
    if (!patientName.trim()) return "Patient name is required.";
    if (patientAge.trim()) {
      const age = Number(patientAge);
      if (!Number.isInteger(age) || age < 0 || age > 130)
        return "Enter a valid age between 0 and 130.";
    }
    return null;
  };

  const goToLabDetails = () => {
    const error = patientError();
    if (error) return void toast.error(error);
    setStep(2);
  };

  const addTest = (test: LabTest) => {
    setCart((current) => {
      const existing = current.find((line) => line.id === test.id);
      return existing
        ? current.map((line) =>
            line.id === test.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { ...test, quantity: 1 }];
    });
    setSearch("");
  };

  const adjust = (id: string, delta: number) => {
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

  const goToReview = () => {
    if (!cart.length) return void toast.error("Add at least one laboratory test.");
    if (discountPaisa > subtotal) return void toast.error("Discount cannot exceed the subtotal.");
    if (paidPaisa < 0) return void toast.error("Amount paid cannot be negative.");
    setStep(3);
  };

  const resetSale = () => {
    setStep(1);
    setPatientId("");
    setPatientName("");
    setPatientAge("");
    setPatientGender("");
    setPatientPhone("");
    setReferringDoctor("");
    setPatientNote("");
    setSearch("");
    setCart([]);
    setDiscount("");
    setPaid("");
    setPaymentMethod("cash");
  };

  const complete = async () => {
    const invalidPatient = patientError();
    if (invalidPatient) return void toast.error(invalidPatient);
    if (!cart.length) return void toast.error("Add at least one laboratory test.");
    if (discountPaisa > subtotal) return void toast.error("Discount cannot exceed the subtotal.");
    if (paidPaisa < 0) return void toast.error("Amount paid cannot be negative.");

    const clientToken = crypto.randomUUID();
    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "create_lab_sale",
      label: `Laboratory sale for ${patientName.trim()}`,
      payload: {
        p_items: cart.map((line) => ({ lab_test_id: line.id, quantity: line.quantity })),
        p_patient_id: patientId || undefined,
        p_patient_name: patientName.trim(),
        p_patient_age: patientAge.trim() ? Number(patientAge) : undefined,
        p_patient_gender: patientGender || undefined,
        p_patient_phone: patientPhone.trim() || undefined,
        p_referring_doctor: referringDoctor.trim() || undefined,
        p_discount_paisa: discountPaisa,
        p_paid_paisa: actualPaid,
        p_payment_method: paymentMethod,
        p_client_token: clientToken,
        p_note: patientNote.trim() || undefined,
      },
    });
    setSaving(false);
    if (result.error) return void toast.error(friendlyError(result.error));

    const saved = result.data as {
      lab_sale_id?: string;
      invoice_no?: string;
      subtotal_paisa?: number;
      discount_paisa?: number;
      total_paisa?: number;
      paid_paisa?: number;
      change_paisa?: number;
    } | null;
    const invoiceNo = result.queued
      ? `LAB-PENDING-${clientToken.slice(0, 8).toUpperCase()}`
      : (saved?.invoice_no ?? "Laboratory receipt");
    const saleId = saved?.lab_sale_id ?? clientToken;
    setPendingReceipt(result.queued);
    setReceipt({
      id: saleId,
      invoice_no: invoiceNo,
      created_at: new Date().toISOString(),
      patient_name: patientName.trim(),
      patient_age: patientAge.trim() ? Number(patientAge) : null,
      patient_gender: patientGender || null,
      patient_phone: patientPhone.trim() || null,
      referring_doctor: referringDoctor.trim() || null,
      subtotal_paisa: saved?.subtotal_paisa ?? subtotal,
      discount_paisa: saved?.discount_paisa ?? discountPaisa,
      total_paisa: saved?.total_paisa ?? total,
      paid_paisa: saved?.paid_paisa ?? actualPaid,
      change_paisa: saved?.change_paisa ?? change,
      payment_method: paymentMethod,
      status: result.queued ? "pending sync" : "completed",
      note: patientNote.trim() || null,
      lab_sale_items: cart.map((line) => ({
        id: `${saleId}-${line.id}`,
        test_name: line.name,
        category: line.category,
        quantity: line.quantity,
        unit_price_paisa: line.price_paisa,
        line_total_paisa: line.price_paisa * line.quantity,
      })),
    });
    toast.success(
      result.queued
        ? "Lab sale saved offline and will synchronize automatically."
        : `Laboratory sale ${invoiceNo} completed.`,
    );
    resetSale();
    if (!result.queued) await client.invalidateQueries();
  };

  return (
    <div>
      <PageHeader
        title="New Lab Sale"
        description="Enter the patient first, choose laboratory tests, then review and create a separate lab receipt."
      />

      <div className="mb-5 grid grid-cols-3 gap-2">
        {STEPS.map((item) => (
          <div
            key={item.number}
            className={`rounded-lg border px-2 py-2 text-center text-xs font-medium sm:text-sm ${
              step === item.number
                ? "border-primary bg-primary/10 text-primary"
                : step > item.number
                  ? "border-success/40 bg-success/10 text-success"
                  : "text-muted-foreground"
            }`}
          >
            <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full border text-[11px]">
              {step > item.number ? <Check className="size-3" /> : item.number}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5" /> Patient details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patients.isError && (
              <ErrorState message="Saved patients are unavailable, but you can still enter a new patient's details below." />
            )}
            <div>
              <Label htmlFor="lab-existing-patient">Existing patient (optional)</Label>
              <SearchableSelect
                id="lab-existing-patient"
                name="patient_id"
                value={patientId}
                disabled={patients.isLoading || patients.isError}
                placeholder={
                  patients.isLoading ? "Loading patients..." : "New patient — enter details below"
                }
                searchPlaceholder="Search by name, phone, or patient code..."
                emptyMessage="No matching patient. Enter a new patient below."
                options={[
                  { value: "", label: "New patient", searchText: "new patient" },
                  ...(patients.data ?? []).map((patient) => ({
                    value: patient.id,
                    label: `${patient.name}${patient.phone ? ` — ${patient.phone}` : ""}`,
                    searchText: `${patient.name} ${patient.phone ?? ""} ${patient.code}`,
                  })),
                ]}
                onValueChange={selectPatient}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="lab-patient-name">Patient name</Label>
                <Input
                  id="lab-patient-name"
                  className="mt-1"
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  placeholder="Full patient name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lab-patient-age">Age</Label>
                <Input
                  id="lab-patient-age"
                  className="mt-1"
                  value={patientAge}
                  onChange={(event) => setPatientAge(event.target.value)}
                  type="number"
                  min="0"
                  max="130"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="lab-patient-gender">Gender</Label>
                <select
                  id="lab-patient-gender"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={patientGender}
                  onChange={(event) => setPatientGender(event.target.value)}
                >
                  <option value="">Not specified</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="lab-patient-phone">Phone</Label>
                <Input
                  id="lab-patient-phone"
                  className="mt-1"
                  value={patientPhone}
                  onChange={(event) => setPatientPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="lab-referring-doctor">Referring doctor</Label>
                <Input
                  id="lab-referring-doctor"
                  className="mt-1"
                  value={referringDoctor}
                  onChange={(event) => setReferringDoctor(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="lab-patient-note">Notes</Label>
                <Textarea
                  id="lab-patient-note"
                  className="mt-1"
                  value={patientNote}
                  onChange={(event) => setPatientNote(event.target.value)}
                  placeholder="Optional billing or patient note"
                />
              </div>
            </div>
            {!patientId && (
              <p className="text-xs text-muted-foreground">
                A new patient entered here will be saved automatically when the lab sale is
                completed.
              </p>
            )}
            {patientId && (
              <p className="text-xs text-muted-foreground">
                Changes made here apply to this laboratory bill only; the saved patient record is
                not overwritten.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={goToLabDetails}>
                Continue to lab details <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-5" /> Select lab tests
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search test name or category"
                  autoComplete="off"
                />
              </div>
            </CardHeader>
            <CardContent>
              {tests.isLoading ? (
                <LoadingRows />
              ) : tests.isError ? (
                <ErrorState message="The laboratory test catalogue could not be loaded. Open this page online once to make it available offline." />
              ) : visibleTests.length ? (
                <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleTests.map((test) => (
                    <button
                      key={test.id}
                      onClick={() => addTest(test)}
                      className="rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <p className="font-medium">{test.name}</p>
                      <p className="text-sm text-muted-foreground">{test.category}</p>
                      <p className="mt-1 font-semibold text-primary">
                        {formatMoney(test.price_paisa)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    search ? "No matching laboratory tests" : "No laboratory tests have been added"
                  }
                  description={
                    search
                      ? "Try a different test name."
                      : "Add the clinic-approved test names and prices in the Lab Test Catalogue first."
                  }
                  action={
                    !search && can("manage_labs") ? (
                      <Button asChild variant="outline">
                        <Link to="/lab-tests">Open Lab Test Catalogue</Link>
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-20 lg:self-start">
            <CardHeader>
              <CardTitle>Lab bill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length ? (
                cart.map((line) => (
                  <div className="border-b pb-3" key={line.id}>
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(line.price_paisa)} each
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatMoney(line.price_paisa * line.quantity)}
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
                        aria-label={`Remove ${line.name}`}
                        onClick={() =>
                          setCart((current) => current.filter((item) => item.id !== line.id))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No tests selected"
                  description="Choose a test from the catalogue."
                />
              )}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <label className="text-sm">
                  Discount (Rs.)
                  <Input
                    className="mt-1"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    inputMode="decimal"
                    min="0"
                    placeholder="0.00"
                  />
                </label>
                <label className="text-sm">
                  Amount paid
                  <Input
                    className="mt-1"
                    value={paid}
                    onChange={(event) => setPaid(event.target.value)}
                    inputMode="decimal"
                    min="0"
                    placeholder={total ? (total / 100).toFixed(2) : "0.00"}
                  />
                </label>
                <label className="col-span-2 text-sm">
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
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatMoney(discountPaisa)}</span>
                </p>
                <p className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </p>
                {balance > 0 && (
                  <p className="flex justify-between text-warning">
                    <span>Balance</span>
                    <span>{formatMoney(balance)}</span>
                  </p>
                )}
                {change > 0 && (
                  <p className="flex justify-between">
                    <span>Change</span>
                    <span>{formatMoney(change)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button className="flex-1" variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 size-4" /> Patient
                </Button>
                <Button className="flex-1" onClick={goToReview} disabled={!cart.length}>
                  Review <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Review laboratory bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Patient:</span> {patientName}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span> {patientPhone || "-"}
              </p>
              <p>
                <span className="text-muted-foreground">Age / gender:</span>{" "}
                {[patientAge, patientGender].filter(Boolean).join(" / ") || "-"}
              </p>
              <p>
                <span className="text-muted-foreground">Referring doctor:</span>{" "}
                {referringDoctor || "-"}
              </p>
            </div>
            <div className="divide-y rounded-lg border">
              {cart.map((line) => (
                <div className="flex justify-between gap-3 p-3" key={line.id}>
                  <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} × {formatMoney(line.price_paisa)}
                    </p>
                  </div>
                  <p className="font-medium">{formatMoney(line.price_paisa * line.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="ml-auto max-w-sm space-y-1 rounded-lg border p-3 text-sm">
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </p>
              {discountPaisa > 0 && (
                <p className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatMoney(discountPaisa)}</span>
                </p>
              )}
              <p className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </p>
              <p className="flex justify-between">
                <span>Paid</span>
                <span>{formatMoney(actualPaid)}</span>
              </p>
              <p className="flex justify-between">
                <span>Balance</span>
                <span>{formatMoney(balance)}</span>
              </p>
              <p className="flex justify-between">
                <span>Change</span>
                <span>{formatMoney(change)}</span>
              </p>
              <p className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize">{paymentMethod}</span>
              </p>
            </div>
            <p className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
              This creates a separate laboratory invoice. It will not be added to medicine sales or
              medicine profit.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep(2)} disabled={saving}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              <Button onClick={complete} disabled={saving}>
                {saving ? "Saving..." : "Complete sale & open receipt"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingReceipt ? "Lab sale saved offline" : "Laboratory receipt ready"}
            </DialogTitle>
            <DialogDescription>
              {pendingReceipt
                ? "The final LAB invoice number will be assigned automatically after synchronization."
                : `Invoice ${receipt?.invoice_no} was saved separately from medicine sales.`}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <p>
                <strong>Patient:</strong> {receipt.patient_name}
              </p>
              <div className="divide-y rounded-lg border">
                {receipt.lab_sale_items.map((line) => (
                  <p className="flex justify-between gap-3 p-3" key={line.id}>
                    <span>
                      {line.test_name} × {line.quantity}
                    </span>
                    <span>{formatMoney(line.line_total_paisa)}</span>
                  </p>
                ))}
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex justify-between">
                  <span>Total</span>
                  <strong>{formatMoney(receipt.total_paisa)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Paid</span>
                  <span>{formatMoney(receipt.paid_paisa)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Change</span>
                  <span>{formatMoney(receipt.change_paisa)}</span>
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setReceipt(null)}>
                  Close
                </Button>
                <Button onClick={() => printLabReceipt(receipt)}>
                  <Printer className="mr-2 size-4" /> Print lab receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
