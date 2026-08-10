import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/low-stock")({
  head: () => ({
    meta: [
      { title: "Low Stock — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Low Stock for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Low Stock — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Low Stock for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Low Stock" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Low Stock will be available in the next build step." />
    </div>
  );
}
