import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

export type ClinicalServiceForEdit = {
  id: string;
  name: string;
  category?: unknown;
  price_paisa?: unknown;
  cost_paisa?: unknown;
  sort_order?: unknown;
  is_active?: unknown;
};

function ServiceFields({ service }: { service?: ClinicalServiceForEdit }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`service-name-${service?.id ?? "new"}`}>Service name</Label>
        <Input
          id={`service-name-${service?.id ?? "new"}`}
          name="name"
          className="mt-1"
          defaultValue={service?.name ?? ""}
          placeholder="e.g. Ceftriaxone IV"
          required
        />
      </div>
      <div>
        <Label htmlFor={`service-category-${service?.id ?? "new"}`}>Category</Label>
        <Input
          id={`service-category-${service?.id ?? "new"}`}
          name="category"
          className="mt-1"
          defaultValue={String(service?.category ?? "IV & Injection")}
          required
        />
      </div>
      <div>
        <Label htmlFor={`service-price-${service?.id ?? "new"}`}>Patient price (Rs.)</Label>
        <Input
          id={`service-price-${service?.id ?? "new"}`}
          name="price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="mt-1"
          defaultValue={fromPaisa(Number(service?.price_paisa ?? 0))}
          required
        />
      </div>
      <div>
        <Label htmlFor={`service-cost-${service?.id ?? "new"}`}>Clinic material cost (Rs.)</Label>
        <Input
          id={`service-cost-${service?.id ?? "new"}`}
          name="cost"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="mt-1"
          defaultValue={fromPaisa(Number(service?.cost_paisa ?? 0))}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional; used only to calculate profit.
        </p>
      </div>
      <div>
        <Label htmlFor={`service-order-${service?.id ?? "new"}`}>Display order</Label>
        <Input
          id={`service-order-${service?.id ?? "new"}`}
          name="sort_order"
          type="number"
          min="0"
          className="mt-1"
          defaultValue={Number(service?.sort_order ?? 0)}
        />
      </div>
      {service && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="is_active" type="checkbox" defaultChecked={service.is_active !== false} />
          Available in New Sale
        </label>
      )}
    </div>
  );
}

function serviceValues(form: FormData, includeActive: boolean) {
  return {
    name: String(form.get("name") ?? "").trim(),
    category: String(form.get("category") ?? "IV & Injection").trim() || "IV & Injection",
    price_paisa: toPaisa(String(form.get("price") ?? "0")),
    cost_paisa: toPaisa(String(form.get("cost") ?? "0")),
    sort_order: Math.max(0, Number(form.get("sort_order") || 0)),
    ...(includeActive ? { is_active: form.get("is_active") === "on" } : {}),
  };
}

export function AddClinicalServiceDialog() {
  const { isAdmin } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!isAdmin) return null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Adding a service requires an internet connection.");
      return;
    }
    const values = serviceValues(new FormData(event.currentTarget), false);
    if (!values.name) {
      toast.error("Service name is required.");
      return;
    }
    if (values.price_paisa < 0 || values.cost_paisa < 0) {
      toast.error("Price and cost cannot be negative.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("clinical_services").insert(values);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Clinical service added to New Sale.");
    setOpen(false);
    await client.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add clinical service</DialogTitle>
          <DialogDescription>
            This service will appear in the IV & Injection box in New Sale.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <ServiceFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditClinicalServiceDialog({ service }: { service: ClinicalServiceForEdit }) {
  const { isAdmin } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!isAdmin) return null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!navigator.onLine) {
      toast.error("Changing a service requires an internet connection.");
      return;
    }
    const values = {
      ...serviceValues(new FormData(event.currentTarget), true),
      updated_at: new Date().toISOString(),
    };
    if (!values.name) {
      toast.error("Service name is required.");
      return;
    }
    if (values.price_paisa < 0 || values.cost_paisa < 0) {
      toast.error("Price and cost cannot be negative.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("clinical_services").update(values).eq("id", service.id);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Clinical service updated.");
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
          <DialogTitle>Edit clinical service</DialogTitle>
          <DialogDescription>
            Change its name, patient price, cost, or availability.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <ServiceFields service={service} />
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
