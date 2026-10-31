import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { InvoiceDialog, type InvoiceSale } from "@/components/InvoiceDialog";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesHistory,
});

function SalesHistory() {
  return (
    <AdminOnly>
      <LiveDataPage
        title="Sales History"
        description="Search by invoice, patient, medicine, date, or amount. Open any sale to review and print it."
        load={liveLoaders.sales}
        deleteConfig={{ table: "sales", recordLabel: "sale" }}
        rowActions={(row) => <InvoiceDialog sale={row as InvoiceSale} />}
      />
    </AdminOnly>
  );
}
