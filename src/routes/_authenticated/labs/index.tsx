import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { LabInvoiceDialog, type LabInvoiceSale } from "@/components/LabInvoiceDialog";

export const Route = createFileRoute("/_authenticated/labs/")({
  component: () => (
    <LiveDataPage
      title="Lab Sales History"
      description="Search by laboratory invoice, patient, test, date, or amount. Lab bills remain separate from medicine sales."
      load={liveLoaders.labSales}
      deleteConfig={{ table: "lab_sales", recordLabel: "laboratory sale" }}
      rowActions={(row) => <LabInvoiceDialog sale={row as LabInvoiceSale} />}
      maxColumns={6}
      showSerialNumber
      compactTable
      hiddenColumns={[
        "patient_age",
        "patient_gender",
        "patient_phone",
        "referring_doctor",
        "subtotal_paisa",
        "discount_paisa",
        "change_paisa",
        "status",
        "note",
        "lab_sale_items",
      ]}
      columnLabels={{
        invoice_no: "Lab invoice",
        created_at: "Date",
        patient_name: "Patient",
        tests: "Tests",
        total_paisa: "Total",
        paid_paisa: "Paid",
        payment_method: "Payment",
      }}
    />
  ),
});
