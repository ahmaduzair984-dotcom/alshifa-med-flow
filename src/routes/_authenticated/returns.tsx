import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({
    meta: [
      { title: "Returns — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Returns for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Returns — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Returns for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Returns" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Returns will be available in the next build step." />
    </div>
  );
}
