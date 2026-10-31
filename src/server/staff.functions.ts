import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToInternalEmail, USERNAME_PATTERN } from "@/lib/staff-credentials";

const roleSchema = z.enum(["admin", "manager", "pharmacist"]);
const usernameSchema = z.string().trim().toLowerCase().min(3).max(32).regex(USERNAME_PATTERN);
const passwordSchema = z.string().min(8).max(128);

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema,
});

const credentialsSchema = z.object({
  userId: z.string().uuid(),
  username: usernameSchema,
  password: passwordSchema,
});

const deleteStaffSchema = z.object({ userId: z.string().uuid() });

type StaffActionResult = { ok: true; userId: string } | { ok: false; message: string };

function failure(message: string): StaffActionResult {
  return { ok: false, message };
}

function safeFailure(error: unknown): StaffActionResult {
  const message = error instanceof Error ? error.message : String(error ?? "");
  console.error(JSON.stringify({ event: "staff_account_action_failed", message }));
  if (/already|registered|duplicate|unique/i.test(message)) {
    return failure("That username is already in use.");
  }
  if (/SUPABASE_SERVICE_ROLE_KEY|Missing Supabase/i.test(message)) {
    return failure("The secure account service has not been configured yet.");
  }
  if (/administrator/i.test(message)) return failure(message);
  return failure("The staff account could not be changed. Please try again.");
}

async function requireActiveAdministrator(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [roleResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("is_active").eq("id", userId).maybeSingle(),
  ]);
  if (roleResult.error) throw roleResult.error;
  if (profileResult.error) throw profileResult.error;
  if (!roleResult.data || !profileResult.data?.is_active) {
    throw new Error("Only an active administrator can manage staff accounts.");
  }
  return supabaseAdmin;
}

async function writeAudit(
  admin: Awaited<ReturnType<typeof requireActiveAdministrator>>,
  userId: string,
  targetId: string,
  action: string,
  description: string,
  changes?: Record<string, string>,
) {
  const { error } = await admin.from("audit_logs").insert({
    user_id: userId,
    action,
    entity: "staff",
    entity_id: targetId,
    description,
    changes: changes ?? null,
  });
  if (error) {
    console.error(JSON.stringify({ event: "staff_audit_failed", message: error.message }));
  }
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => createStaffSchema.parse(input))
  .handler(async ({ data, context }): Promise<StaffActionResult> => {
    try {
      const admin = await requireActiveAdministrator(context.userId);
      const internalEmail = usernameToInternalEmail(data.username);
      const created = await admin.auth.admin.createUser({
        email: internalEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName,
          username: data.username,
          managed_by_clinic: true,
        },
      });
      if (created.error || !created.data.user) {
        return safeFailure(created.error ?? new Error("Account was not created."));
      }

      const newUserId = created.data.user.id;
      const profileResult = await admin.from("profiles").upsert({
        id: newUserId,
        full_name: data.fullName,
        email: internalEmail,
        is_active: true,
      });
      const deleteRoles = await admin.from("user_roles").delete().eq("user_id", newUserId);
      const roleResult = deleteRoles.error
        ? deleteRoles
        : await admin.from("user_roles").insert({ user_id: newUserId, role: data.role });

      if (profileResult.error || roleResult.error) {
        await admin.auth.admin.deleteUser(newUserId);
        return safeFailure(profileResult.error ?? roleResult.error);
      }

      await writeAudit(
        admin,
        context.userId,
        newUserId,
        "create_staff",
        `Administrator created staff account ${data.username}`,
        { username: data.username, role: data.role },
      );
      return { ok: true, userId: newUserId };
    } catch (error) {
      return safeFailure(error);
    }
  });

export const setStaffCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => credentialsSchema.parse(input))
  .handler(async ({ data, context }): Promise<StaffActionResult> => {
    try {
      if (data.userId === context.userId) {
        return failure("Your original administrator login is kept unchanged for safety.");
      }
      const admin = await requireActiveAdministrator(context.userId);
      const internalEmail = usernameToInternalEmail(data.username);
      const updated = await admin.auth.admin.updateUserById(data.userId, {
        email: internalEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          username: data.username,
          managed_by_clinic: true,
        },
      });
      if (updated.error) return safeFailure(updated.error);

      const profileResult = await admin
        .from("profiles")
        .update({ email: internalEmail })
        .eq("id", data.userId);
      if (profileResult.error) return safeFailure(profileResult.error);

      await writeAudit(
        admin,
        context.userId,
        data.userId,
        "set_staff_credentials",
        `Administrator set username ${data.username}`,
        { username: data.username },
      );
      return { ok: true, userId: data.userId };
    } catch (error) {
      return safeFailure(error);
    }
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => deleteStaffSchema.parse(input))
  .handler(async ({ data, context }): Promise<StaffActionResult> => {
    try {
      if (data.userId === context.userId) {
        return failure("You cannot delete the account you are currently using.");
      }
      const admin = await requireActiveAdministrator(context.userId);
      const targetRoles = await admin.from("user_roles").select("role").eq("user_id", data.userId);
      if (targetRoles.error) return safeFailure(targetRoles.error);

      if (targetRoles.data?.some((row) => row.role === "admin")) {
        const adminRoles = await admin.from("user_roles").select("user_id").eq("role", "admin");
        if (adminRoles.error) return safeFailure(adminRoles.error);
        const adminIds = (adminRoles.data ?? []).map((row) => row.user_id);
        const activeAdmins = adminIds.length
          ? await admin.from("profiles").select("id").in("id", adminIds).eq("is_active", true)
          : { data: [], error: null };
        if (activeAdmins.error) return safeFailure(activeAdmins.error);
        if ((activeAdmins.data ?? []).length <= 1) {
          return failure("The clinic must keep at least one active administrator account.");
        }
      }

      const deleted = await admin.auth.admin.deleteUser(data.userId);
      if (deleted.error) return safeFailure(deleted.error);
      await writeAudit(
        admin,
        context.userId,
        data.userId,
        "delete_staff",
        "Administrator deleted a staff account",
      );
      return { ok: true, userId: data.userId };
    } catch (error) {
      return safeFailure(error);
    }
  });
