import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Audit Log for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Audit Log — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Audit Log for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Audit Log" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Audit Log will be available in the next build step." />
    </div>
  );
}
