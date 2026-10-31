import { createFileRoute } from "@tanstack/react-router";
import { StaffManager } from "@/components/StaffManager";
export const Route = createFileRoute("/_authenticated/users")({ component: StaffManager });
