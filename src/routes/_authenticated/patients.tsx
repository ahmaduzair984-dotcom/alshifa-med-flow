import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Patients — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Patients for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Patients — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Patients for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Patients" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Patients will be available in the next build step." />
    </div>
  );
}
