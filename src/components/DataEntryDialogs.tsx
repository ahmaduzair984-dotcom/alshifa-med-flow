import { useState, type ComponentProps, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
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
import { friendlyError } from "@/lib/pharmacy";
import { fromPaisa, toPaisa } from "@/lib/money";
import { runOrQueueMutation } from "@/lib/offline-queue";

function optional(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

function useEntryDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  return { open, setOpen, saving, setSaving, client };
}

export function AddMedicineDialog() {
  const { open, setOpen, saving, setSaving, client } = useEntryDialog();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const brandName = String(form.get("brand_name") ?? "").trim();
    if (!brandName) {
      toast.error("Medicine name is required.");
      return;
    }
    const salePrice = toPaisa(String(form.get("sale_price") ?? "0"));
    if (salePrice < 0) {
      toast.error("Selling price cannot be negative.");
      return;
    }
    setSaving(true);
    const payload = {
      id: crypto.randomUUID(),
      brand_name: brandName,
      generic_name: optional(form, "generic_name"),
      strength: optional(form, "strength"),
      dosage_form: optional(form, "dosage_form"),
      manufacturer: optional(form, "manufacturer"),
      base_unit: String(form.get("base_unit") || "Tablet"),
      sale_price_paisa: salePrice,
      min_stock: Math.max(0, Number(form.get("min_stock") || 0)),
      barcode: optional(form, "barcode"),
      prescription_required: form.get("prescription_required") === "on",
      notes: optional(form, "notes"),
    };
    const result = await runOrQueueMutation({
      kind: "insert_product",
      label: `New medicine: ${brandName}`,
      payload,
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Medicine saved offline and will be added when the connection returns."
        : "Medicine added. Add a purchase next to put it in stock.",
    );
    setOpen(false);
    if (!result.queued) {
      await client.invalidateQueries({ queryKey: ["live-page", "Medicine Catalog"] });
      await client.invalidateQueries({ queryKey: ["pos-products"] });
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add medicine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add medicine</DialogTitle>
          <DialogDescription>
            Create the catalogue record first. Stock is added separately through New Purchase.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <Field label="Medicine name" name="brand_name" required />
          <Field label="Generic name" name="generic_name" />
          <Field label="Strength" name="strength" placeholder="e.g. 500mg" />
          <Field label="Dosage form" name="dosage_form" placeholder="Tablet, Syrup…" />
          <Field label="Manufacturer" name="manufacturer" />
          <div>
            <Label htmlFor="base_unit">Base unit</Label>
            <select
              id="base_unit"
              name="base_unit"
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option>Tablet</option>
              <option>Capsule</option>
              <option>Bottle</option>
              <option>Tube</option>
              <option>Vial</option>
              <option>Ampoule</option>
              <option>Piece</option>
              <option>Sachet</option>
            </select>
          </div>
          <Field
            label="Selling price (Rs.)"
            name="sale_price"
            type="number"
            step="0.01"
            min="0"
            required
          />
          <Field
            label="Minimum stock"
            name="min_stock"
            type="number"
            min="0"
            defaultValue="10"
            required
          />
          <Field label="Barcode" name="barcode" />
          <label className="flex items-center gap-2 text-sm sm:pt-6">
            <input name="prescription_required" type="checkbox" /> Prescription required
          </label>
          <div className="sm:col-span-2">
            <Label htmlFor="medicine-notes">Notes</Label>
            <Textarea id="medicine-notes" name="notes" className="mt-1" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save medicine"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MedicineForEdit = {
  id: string;
  brand_name: string;
  generic_name?: unknown;
  strength?: unknown;
  dosage_form?: unknown;
  manufacturer?: unknown;
  sale_price_paisa?: unknown;
  min_stock?: unknown;
  barcode?: unknown;
  prescription_required?: unknown;
  notes?: unknown;
  is_active?: unknown;
};

export function EditMedicineDialog({ medicine }: { medicine: MedicineForEdit }) {
  const { open, setOpen, saving, setSaving, client } = useEntryDialog();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const brandName = String(form.get("brand_name") ?? "").trim();
    if (!brandName) {
      toast.error("Medicine name is required.");
      return;
    }
    setSaving(true);
    const values = {
      brand_name: brandName,
      generic_name: optional(form, "generic_name"),
      strength: optional(form, "strength"),
      dosage_form: optional(form, "dosage_form"),
      manufacturer: optional(form, "manufacturer"),
      sale_price_paisa: toPaisa(String(form.get("sale_price") ?? "0")),
      min_stock: Math.max(0, Number(form.get("min_stock") || 0)),
      barcode: optional(form, "barcode"),
      prescription_required: form.get("prescription_required") === "on",
      notes: optional(form, "notes"),
      is_active: form.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    };
    const result = await runOrQueueMutation({
      kind: "update_product",
      label: `Medicine update: ${brandName}`,
      payload: { id: medicine.id, values },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Medicine changes saved offline and will synchronize automatically."
        : "Medicine updated.",
    );
    setOpen(false);
    if (!result.queued) await client.invalidateQueries();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1 size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit medicine</DialogTitle>
          <DialogDescription>
            Update medicine details, price, low-stock level, or availability.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <Field
            label="Medicine name"
            name="brand_name"
            defaultValue={medicine.brand_name}
            required
          />
          <Field
            label="Generic name"
            name="generic_name"
            defaultValue={String(medicine.generic_name ?? "")}
          />
          <Field label="Strength" name="strength" defaultValue={String(medicine.strength ?? "")} />
          <Field
            label="Dosage form"
            name="dosage_form"
            defaultValue={String(medicine.dosage_form ?? "")}
          />
          <Field
            label="Manufacturer"
            name="manufacturer"
            defaultValue={String(medicine.manufacturer ?? "")}
          />
          <Field
            label="Selling price (Rs.)"
            name="sale_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={fromPaisa(Number(medicine.sale_price_paisa ?? 0))}
            required
          />
          <Field
            label="Minimum stock"
            name="min_stock"
            type="number"
            min="0"
            defaultValue={Number(medicine.min_stock ?? 0)}
            required
          />
          <Field label="Barcode" name="barcode" defaultValue={String(medicine.barcode ?? "")} />
          <label className="flex items-center gap-2 text-sm sm:pt-6">
            <input
              name="prescription_required"
              type="checkbox"
              defaultChecked={Boolean(medicine.prescription_required)}
            />{" "}
            Prescription required
          </label>
          <label className="flex items-center gap-2 text-sm sm:pt-6">
            <input name="is_active" type="checkbox" defaultChecked={medicine.is_active !== false} />{" "}
            Available for sale
          </label>
          <div className="sm:col-span-2">
            <Label htmlFor={`notes-${medicine.id}`}>Notes</Label>
            <Textarea
              id={`notes-${medicine.id}`}
              name="notes"
              className="mt-1"
              defaultValue={String(medicine.notes ?? "")}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSupplierDialog() {
  const { open, setOpen, saving, setSaving, client } = useEntryDialog();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Supplier name is required.");
      return;
    }
    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "insert_supplier",
      label: `New supplier: ${name}`,
      payload: {
        id: crypto.randomUUID(),
        name,
        company: optional(form, "company"),
        contact_person: optional(form, "contact_person"),
        phone: optional(form, "phone"),
        email: optional(form, "email"),
        address: optional(form, "address"),
      },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Supplier saved offline and will synchronize automatically."
        : "Supplier added.",
    );
    setOpen(false);
    if (!result.queued) {
      await client.invalidateQueries({ queryKey: ["live-page", "Suppliers"] });
      await client.invalidateQueries({ queryKey: ["purchase-suppliers"] });
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add supplier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <Field label="Supplier name" name="name" required />
          <Field label="Company" name="company" />
          <Field label="Contact person" name="contact_person" />
          <Field label="Phone" name="phone" />
          <Field label="Email" name="email" type="email" />
          <Field label="Address" name="address" />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPatientDialog() {
  const { open, setOpen, saving, setSaving, client } = useEntryDialog();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Patient name is required.");
      return;
    }
    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "insert_patient",
      label: `New patient: ${name}`,
      payload: {
        id: crypto.randomUUID(),
        name,
        phone: optional(form, "phone"),
        age: optional(form, "age") ? Number(form.get("age")) : null,
        gender: optional(form, "gender"),
        address: optional(form, "address"),
        notes: optional(form, "notes"),
      },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Patient saved offline and will synchronize automatically."
        : "Patient added.",
    );
    setOpen(false);
    if (!result.queued) await client.invalidateQueries({ queryKey: ["live-page", "Patients"] });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add patient
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add patient</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <Field label="Patient name" name="name" required />
          <Field label="Phone" name="phone" />
          <Field label="Age" name="age" type="number" min="0" />
          <div>
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              name="gender"
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Not specified</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address" name="address" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="patient-notes">Notes</Label>
            <Textarea id="patient-notes" name="notes" className="mt-1" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save patient"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PatientForEdit = {
  id: string;
  code?: unknown;
  name: string;
  phone?: unknown;
  age?: unknown;
  gender?: unknown;
  address?: unknown;
  notes?: unknown;
};

export function EditPatientDialog({ patient }: { patient: PatientForEdit }) {
  const { open, setOpen, saving, setSaving, client } = useEntryDialog();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const ageValue = optional(form, "age");
    const age = ageValue ? Number(ageValue) : null;
    if (!name) {
      toast.error("Patient name is required.");
      return;
    }
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 130)) {
      toast.error("Enter a valid age between 0 and 130.");
      return;
    }

    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "update_patient",
      label: `Patient update: ${name}`,
      payload: {
        id: patient.id,
        values: {
          name,
          phone: optional(form, "phone"),
          age,
          gender: optional(form, "gender"),
          address: optional(form, "address"),
          notes: optional(form, "notes"),
        },
      },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Patient changes saved offline and will synchronize automatically."
        : "Patient updated.",
    );
    setOpen(false);
    if (!result.queued) {
      await client.invalidateQueries({ queryKey: ["live-page", "Patients"] });
      await client.invalidateQueries({ queryKey: ["pos-patients"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1 size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit patient</DialogTitle>
          <DialogDescription>
            Correct the patient details used in patient search and future sales.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <div>
            <Label htmlFor={`patient-code-${patient.id}`}>Patient code</Label>
            <Input
              id={`patient-code-${patient.id}`}
              value={String(patient.code ?? "")}
              className="mt-1"
              readOnly
              disabled
            />
          </div>
          <Field label="Patient name" name="name" defaultValue={patient.name} required />
          <Field label="Phone" name="phone" defaultValue={String(patient.phone ?? "")} />
          <Field
            label="Age"
            name="age"
            type="number"
            min="0"
            max="130"
            defaultValue={String(patient.age ?? "")}
          />
          <div>
            <Label htmlFor={`patient-gender-${patient.id}`}>Gender</Label>
            <select
              id={`patient-gender-${patient.id}`}
              name="gender"
              defaultValue={String(patient.gender ?? "")}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Not specified</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address" name="address" defaultValue={String(patient.address ?? "")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`patient-notes-${patient.id}`}>Notes</Label>
            <Textarea
              id={`patient-notes-${patient.id}`}
              name="notes"
              defaultValue={String(patient.notes ?? "")}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
