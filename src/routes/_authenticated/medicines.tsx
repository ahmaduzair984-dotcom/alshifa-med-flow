import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Catalog — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Medicine Catalog for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Medicine Catalog — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Medicine Catalog for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Medicine Catalog" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Medicine Catalog will be available in the next build step." />
    </div>
  );
}
