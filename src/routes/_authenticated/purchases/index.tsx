import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { PurchaseDetailsDialog, type PurchaseRecord } from "@/components/PurchaseDetailsDialog";

export const Route = createFileRoute("/_authenticated/purchases/")({
  component: () => (
    <LiveDataPage
      title="Purchase History"
      description="Search by medicine, supplier, reference, or date. Open a purchase to review quantities and buying prices."
      load={liveLoaders.purchases}
      deleteConfig={{ table: "purchases", recordLabel: "purchase" }}
      rowActions={(row) => <PurchaseDetailsDialog purchase={row as PurchaseRecord} />}
      maxColumns={6}
      showSerialNumber
      compactTable
      hiddenColumns={["subtotal_paisa", "discount_paisa", "note", "purchase_items", "created_at"]}
      columnLabels={{
        purchase_date: "Date",
        reference: "Reference",
        supplier: "Supplier",
        medicine: "Medicine / buying details",
        total_paisa: "Total",
        paid_paisa: "Paid",
      }}
    />
  ),
});
