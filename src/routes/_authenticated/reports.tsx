import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Reports for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Reports — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Reports for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Reports" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Reports will be available in the next build step." />
    </div>
  );
}
