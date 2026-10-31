import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { AddLabTestDialog, EditLabTestDialog } from "@/components/LabTestDialogs";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui-kit";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lab-tests")({
  component: LabTestCatalogue,
});

function LabTestCatalogue() {
  const { can, loading } = useAuth();
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingRows />
        </CardContent>
      </Card>
    );
  }
  if (!can("manage_labs")) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<ShieldCheck className="size-7" />}
            title="Catalogue access restricted"
            description="Only the administrator or manager can change laboratory tests and prices."
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <LiveDataPage
      title="Lab Test Catalogue"
      description="Manage the clinic-approved tests, patient prices, and private laboratory costs."
      load={liveLoaders.labTests}
      actions={<AddLabTestDialog />}
      deleteConfig={{ table: "lab_tests", recordLabel: "laboratory test", archiveIfLinked: true }}
      rowActions={(row) => (
        <EditLabTestDialog
          test={{
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
      maxColumns={6}
      showSerialNumber
      compactTable
      hiddenColumns={["created_at", "updated_at"]}
      columnLabels={{
        name: "Test",
        category: "Category",
        price_paisa: "Patient price",
        cost_paisa: "Lab cost",
        is_active: "Available",
        sort_order: "Order",
      }}
    />
  );
}
