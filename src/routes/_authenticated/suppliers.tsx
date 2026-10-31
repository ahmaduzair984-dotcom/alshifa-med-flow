import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { AddSupplierDialog } from "@/components/DataEntryDialogs";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: () => (
    <LiveDataPage
      title="Suppliers"
      description="Manage supplier contacts before recording purchases."
      load={liveLoaders.suppliers}
      actions={<AddSupplierDialog />}
      deleteConfig={{ table: "suppliers", recordLabel: "supplier" }}
    />
  ),
});
