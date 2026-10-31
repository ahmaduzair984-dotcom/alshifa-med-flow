import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { AddExpenseDialog, EditExpenseDialog } from "@/components/ExpenseDialogs";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: () => (
    <LiveDataPage
      title="Expenses"
      description="Record clinic costs. Expenses are automatically deducted from gross profit in Reports."
      load={liveLoaders.expenses}
      actions={<AddExpenseDialog />}
      deleteConfig={{ table: "expenses", recordLabel: "expense" }}
      rowActions={(row) => (
        <EditExpenseDialog
          expense={{
            id: String(row["id"]),
            expense_date: row["expense_date"],
            category: row["category"],
            description: row["description"],
            amount_paisa: row["amount_paisa"],
            payment_method: row["payment_method"],
            notes: row["notes"],
          }}
        />
      )}
      maxColumns={5}
      showSerialNumber
      compactTable
      hiddenColumns={["notes", "created_at"]}
      columnLabels={{
        expense_date: "Date",
        category: "Category",
        description: "Description",
        amount_paisa: "Amount",
        payment_method: "Payment",
      }}
    />
  ),
});
