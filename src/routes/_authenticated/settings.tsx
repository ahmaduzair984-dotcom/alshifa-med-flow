import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Settings for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Settings — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Settings for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Settings" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Settings will be available in the next build step." />
    </div>
  );
}
