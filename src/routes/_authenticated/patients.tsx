import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { AddPatientDialog, EditPatientDialog } from "@/components/DataEntryDialogs";

export const Route = createFileRoute("/_authenticated/patients")({
  component: () => (
    <LiveDataPage
      title="Patients"
      description="Patient selection is optional for walk-in sales."
      load={liveLoaders.patients}
      actions={<AddPatientDialog />}
      deleteConfig={{ table: "patients", recordLabel: "patient" }}
      rowActions={(row) => (
        <EditPatientDialog
          patient={{
            id: String(row["id"]),
            code: row["code"],
            name: String(row["name"] ?? ""),
            phone: row["phone"],
            age: row["age"],
            gender: row["gender"],
            address: row["address"],
            notes: row["notes"],
          }}
        />
      )}
    />
  ),
});
