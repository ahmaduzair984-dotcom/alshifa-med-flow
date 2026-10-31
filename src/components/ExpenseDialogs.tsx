import { useState, type FormEvent } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { fromPaisa, toPaisa } from "@/lib/money";
import { runOrQueueMutation } from "@/lib/offline-queue";
import { friendlyError } from "@/lib/pharmacy";

const CATEGORIES = [
  "Rent",
  "Electricity",
  "Salaries",
  "Transport",
  "Supplies",
  "Miscellaneous",
] as const;

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

export type ExpenseForEdit = {
  id: string;
  expense_date?: unknown;
  category?: unknown;
  description?: unknown;
  amount_paisa?: unknown;
  payment_method?: unknown;
  notes?: unknown;
};

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optional(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

function expenseValues(form: FormData) {
  return {
    expense_date: String(form.get("expense_date") || localDate()),
    category: String(form.get("category") || "Miscellaneous").trim(),
    description: optional(form, "description"),
    amount_paisa: toPaisa(String(form.get("amount") ?? "0")),
    payment_method: String(form.get("payment_method") || "cash"),
    notes: optional(form, "notes"),
  };
}

function ExpenseFields({ expense }: { expense?: ExpenseForEdit }) {
  const id = expense?.id ?? "new";
  const category = String(expense?.category ?? "Miscellaneous");
  const paymentMethod = String(expense?.payment_method ?? "cash");
  const hasCustomCategory = !CATEGORIES.some((item) => item === category);
  const hasCustomPayment = !PAYMENT_METHODS.some((item) => item.value === paymentMethod);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`expense-date-${id}`}>Date</Label>
        <Input
          id={`expense-date-${id}`}
          name="expense_date"
          type="date"
          className="mt-1"
          defaultValue={String(expense?.expense_date ?? localDate())}
          required
        />
      </div>
      <div>
        <Label htmlFor={`expense-category-${id}`}>Category</Label>
        <select
          id={`expense-category-${id}`}
          name="category"
          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={category}
          required
        >
          {hasCustomCategory && <option value={category}>{category}</option>}
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`expense-description-${id}`}>Description</Label>
        <Input
          id={`expense-description-${id}`}
          name="description"
          className="mt-1"
          defaultValue={String(expense?.description ?? "")}
          placeholder="e.g. August electricity bill"
          required
        />
      </div>
      <div>
        <Label htmlFor={`expense-amount-${id}`}>Amount (Rs.)</Label>
        <Input
          id={`expense-amount-${id}`}
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          className="mt-1"
          defaultValue={
            expense ? fromPaisa(Number(expense.amount_paisa ?? 0)) : undefined
          }
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <Label htmlFor={`expense-payment-${id}`}>Payment method</Label>
        <select
          id={`expense-payment-${id}`}
          name="payment_method"
          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={paymentMethod}
          required
        >
          {hasCustomPayment && <option value={paymentMethod}>{paymentMethod}</option>}
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`expense-notes-${id}`}>Notes (optional)</Label>
        <Textarea
          id={`expense-notes-${id}`}
          name="notes"
          className="mt-1"
          defaultValue={String(expense?.notes ?? "")}
          placeholder="Receipt number or any additional details"
        />
      </div>
    </div>
  );
}

function validate(values: ReturnType<typeof expenseValues>) {
  if (!values.category) return "Select an expense category.";
  if (!values.description) return "Expense description is required.";
  if (values.amount_paisa <= 0) return "Expense amount must be greater than zero.";
  return null;
}

export function AddExpenseDialog() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = expenseValues(new FormData(event.currentTarget));
    const validationError = validate(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "insert_expense",
      label: `New expense: ${values.description}`,
      payload: {
        id: crypto.randomUUID(),
        ...values,
        user_id: user?.id ?? null,
      },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Expense saved offline and will synchronize automatically."
        : "Expense recorded and included in financial reports.",
    );
    setOpen(false);
    if (!result.queued) await client.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Record a clinic cost. It will be deducted when calculating net profit.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <ExpenseFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditExpenseDialog({ expense }: { expense: ExpenseForEdit }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = expenseValues(new FormData(event.currentTarget));
    const validationError = validate(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const result = await runOrQueueMutation({
      kind: "update_expense",
      label: `Expense update: ${values.description}`,
      payload: { id: expense.id, values },
    });
    setSaving(false);
    if (result.error) {
      toast.error(friendlyError(result.error));
      return;
    }
    toast.success(
      result.queued
        ? "Expense changes saved offline and will synchronize automatically."
        : "Expense updated in the financial reports.",
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
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>
            Correct this cost and update the clinic's financial totals.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <ExpenseFields expense={expense} />
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
