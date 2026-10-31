import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import {
  AddClinicalServiceDialog,
  EditClinicalServiceDialog,
} from "@/components/ClinicalServiceDialogs";

export const Route = createFileRoute("/_authenticated/services")({
  component: () => (
    <LiveDataPage
      title="IV & Clinical Services"
      description="Manage injections, IV packages, their patient prices and clinic material costs. These services do not change medicine stock."
      load={liveLoaders.clinicalServices}
      actions={<AddClinicalServiceDialog />}
      deleteConfig={{
        table: "clinical_services",
        recordLabel: "clinical service",
        archiveIfLinked: true,
      }}
      rowActions={(row) => (
        <EditClinicalServiceDialog
          service={{
            id: String(row["id"]),
            name: String(row["name"] ?? ""),
            category: row["category"],
            price_paisa: row["price_paisa"],
            cost_paisa: row["cost_paisa"],
            sort_order: row["sort_order"],
            is_active: row["is_active"],
          }}
        />
      )}
    />
  ),
});
