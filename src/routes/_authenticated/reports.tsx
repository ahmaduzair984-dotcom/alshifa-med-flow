import { createFileRoute } from "@tanstack/react-router";
import { ReportsDashboard } from "@/components/ReportsDashboard";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <AdminOnly>
      <ReportsDashboard />
    </AdminOnly>
  ),
});
