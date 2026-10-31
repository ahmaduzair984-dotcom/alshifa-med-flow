import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { AddMedicineDialog, EditMedicineDialog } from "@/components/DataEntryDialogs";

export const Route = createFileRoute("/_authenticated/medicines")({
  component: () => (
    <LiveDataPage
      title="Medicine Catalog"
      description="Add medicines here, then use New Purchase to add their stock."
      load={liveLoaders.medicines}
      actions={<AddMedicineDialog />}
      showSerialNumber
      compactTable
      columnLabels={{
        brand_name: "Medicine",
        generic_name: "Generic",
        strength: "Strength",
        dosage_form: "Form",
        manufacturer: "Manufacturer",
        base_unit: "Unit",
        sale_price_paisa: "Sale price",
      }}
      deleteConfig={{ table: "products", recordLabel: "medicine", archiveIfLinked: true }}
      rowActions={(row) => (
        <EditMedicineDialog
          medicine={{
            id: String(row["id"]),
            brand_name: String(row["brand_name"] ?? ""),
            generic_name: row["generic_name"],
            strength: row["strength"],
            dosage_form: row["dosage_form"],
            manufacturer: row["manufacturer"],
            sale_price_paisa: row["sale_price_paisa"],
            min_stock: row["min_stock"],
            barcode: row["barcode"],
            prescription_required: row["prescription_required"],
            notes: row["notes"],
            is_active: row["is_active"],
          }}
        />
      )}
    />
  ),
});
