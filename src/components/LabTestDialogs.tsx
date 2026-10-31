import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
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
import { fromPaisa, toPaisa } from "@/lib/money";
import { friendlyError } from "@/lib/pharmacy";

export type LabTestForEdit = {
  id: string;
  name: string;
  category?: unknown;
  price_paisa?: unknown;
  cost_paisa?: unknown;
  sort_order?: unknown;
  is_active?: unknown;
};

function LabTestFields({ test }: { test?: LabTestForEdit }) {
  const id = test?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`lab-test-name-${id}`}>Test name</Label>
        <Input
          id={`lab-test-name-${id}`}
          name="name"
          className="mt-1"
          defaultValue={test?.name ?? ""}
          placeholder="e.g. Complete Blood Count (CBC)"
          required
        />
      </div>
      <div>
        <Label htmlFor={`lab-test-category-${id}`}>Category</Label>
        <Input
          id={`lab-test-category-${id}`}
          name="category"
          className="mt-1"
          defaultValue={String(test?.category ?? "Laboratory")}
          placeholder="e.g. Haematology"
          required
        />
      </div>
      <div>
        <Label htmlFor={`lab-test-order-${id}`}>Display order</Label>
        <Input
          id={`lab-test-order-${id}`}
          name="sort_order"
          type="number"
          min="0"
          className="mt-1"
          defaultValue={Number(test?.sort_order ?? 0)}
        />
      </div>
      <div>
        <Label htmlFor={`lab-test-price-${id}`}>Patient price (Rs.)</Label>
        <Input
          id={`lab-test-price-${id}`}
          name="price"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          className="mt-1"
          defaultValue={test ? fromPaisa(Number(test.price_paisa ?? 0)) : undefined}
          required
        />
      </div>
      <div>
        <Label htmlFor={`lab-test-cost-${id}`}>Clinic / external lab cost (Rs.)</Label>
        <Input
          id={`lab-test-cost-${id}`}
          name="cost"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="mt-1"
          defaultValue={test ? fromPaisa(Number(test.cost_paisa ?? 0)) : 0}
        />
        <p className="mt-1 text-xs text-muted-foreground">Used only for separate lab profit.</p>
      </div>
      {test && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="is_active" type="checkbox" defaultChecked={test.is_active !== false} />
          Available in New Lab Sale
        </label>
      )}
    </div>
  );
}

function values(form: FormData, includeActive: boolean) {
  return {
    name: String(form.get("name") ?? "").trim(),
    category: String(form.get("category") ?? "Laboratory").trim() || "Laboratory",
    price_paisa: toPaisa(String(form.get("price") ?? "0")),
    cost_paisa: toPaisa(String(form.get("cost") ?? "0")),
    sort_order: Math.max(0, Number(form.get("sort_order") || 0)),
    ...(includeActive ? { is_active: form.get("is_active") === "on" } : {}),
  };
}

function validationError(value: ReturnType<typeof values>) {
  if (!value.name) return "Test name is required.";
  if (value.price_paisa <= 0) return "Patient price must be greater than zero.";
  if (value.cost_paisa < 0) return "Lab cost cannot be negative.";
  return null;
}

export function AddLabTestDialog() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Adding a laboratory test requires an internet connection.");
      return;
    }
    const value = values(new FormData(event.currentTarget), false);
    const invalid = validationError(value);
    if (invalid) return void toast.error(invalid);
    setSaving(true);
    const { error } = await supabase.from("lab_tests").insert(value);
    setSaving(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Laboratory test added with its approved price.");
    setOpen(false);
    await client.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add lab test
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add laboratory test</DialogTitle>
          <DialogDescription>
            Set the approved patient price and the private cost used for lab profit.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <LabTestFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save lab test"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditLabTestDialog({ test }: { test: LabTestForEdit }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Changing a laboratory test requires an internet connection.");
      return;
    }
    const value = {
      ...values(new FormData(event.currentTarget), true),
      updated_at: new Date().toISOString(),
    };
    const invalid = validationError(value);
    if (invalid) return void toast.error(invalid);
    setSaving(true);
    const { error } = await supabase.from("lab_tests").update(value).eq("id", test.id);
    setSaving(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Laboratory test updated.");
    setOpen(false);
    await client.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1 size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit laboratory test</DialogTitle>
          <DialogDescription>Update its price, cost, category, or availability.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <LabTestFields test={test} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
