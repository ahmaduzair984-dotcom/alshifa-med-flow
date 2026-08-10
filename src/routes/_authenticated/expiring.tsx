import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/expiring")({
  head: () => ({
    meta: [
      { title: "Expiring Medicines — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Expiring Medicines for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Expiring Medicines — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Expiring Medicines for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Expiring Medicines" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Expiring Medicines will be available in the next build step." />
    </div>
  );
}
