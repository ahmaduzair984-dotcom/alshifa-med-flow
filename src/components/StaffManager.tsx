import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/ui-kit";
import { friendlyError, formatDate, type AppRole } from "@/lib/pharmacy";
import { isValidUsername, managedUsernameFromEmail } from "@/lib/staff-credentials";
import {
  createStaffAccount,
  deleteStaffAccount,
  setStaffCredentials,
} from "@/server/staff.functions";

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  role: AppRole;
};

type CreateStaffInput = {
  fullName: string;
  username: string;
  password: string;
  role: AppRole;
};

function usernameLabel(row: StaffRow, currentUserId: string | undefined) {
  const username = managedUsernameFromEmail(row.email);
  if (username) return username;
  return row.id === currentUserId ? "Original administrator login" : "Existing account";
}

function CreateStaffDialog({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: CreateStaffInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const username = String(form.get("username") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (!isValidUsername(username)) {
      toast.error("Use 3–32 lowercase letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (password.length < 8) {
      toast.error("Use at least 8 characters for the password.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    const created = await onCreate({
      fullName: String(form.get("fullName") ?? "").trim(),
      username,
      password,
      role: String(form.get("role") ?? "pharmacist") as AppRole,
    });
    if (created) {
      formElement.reset();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add staff account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add staff account</DialogTitle>
          <DialogDescription>
            Choose the staff member’s username, initial password and access level. No email is
            needed.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="staff-full-name">Full name</Label>
            <Input id="staff-full-name" name="fullName" required minLength={2} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-username">Username</Label>
            <Input
              id="staff-username"
              name="username"
              required
              minLength={3}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="e.g. pharmacist1"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters and numbers; dots, dashes and underscores are also allowed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-confirm">Confirm password</Label>
              <Input
                id="staff-confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <select
              id="staff-role"
              name="role"
              defaultValue="pharmacist"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="pharmacist">Pharmacist</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  target,
  busy,
  onOpenChange,
  onSave,
}: {
  target: StaffRow | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (target: StaffRow, username: string, password: string) => Promise<boolean>;
}) {
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (!isValidUsername(username)) {
      toast.error("Use 3–32 lowercase letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (password.length < 8) {
      toast.error("Use at least 8 characters for the password.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    if (await onSave(target, username, password)) onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set username and password</DialogTitle>
          <DialogDescription>
            Replace the sign-in credentials for {target?.full_name || "this staff member"}. Their
            previous login will stop working.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <form key={target.id} className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="credentials-username">Username</Label>
              <Input
                id="credentials-username"
                name="username"
                defaultValue={managedUsernameFromEmail(target.email) ?? ""}
                required
                minLength={3}
                maxLength={32}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credentials-password">New password</Label>
              <Input
                id="credentials-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credentials-confirm">Confirm new password</Label>
              <Input
                id="credentials-confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save credentials
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffManager() {
  const { isAdmin, user } = useAuth();
  const client = useQueryClient();
  const createAccount = useServerFn(createStaffAccount);
  const saveCredentials = useServerFn(setStaffCredentials);
  const deleteAccount = useServerFn(deleteStaffAccount);
  const [busy, setBusy] = useState(false);
  const [credentialsTarget, setCredentialsTarget] = useState<StaffRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);

  const staff = useQuery({
    queryKey: ["staff-management"],
    queryFn: async (): Promise<StaffRow[]> => {
      const [{ data: profiles, error: profileError }, { data: roleRows, error: roleError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, is_active, created_at")
            .order("created_at"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      const roleByUser = new Map((roleRows ?? []).map((row) => [row.user_id, row.role as AppRole]));
      return (profiles ?? []).map((profile) => ({
        ...profile,
        role: roleByUser.get(profile.id) ?? "pharmacist",
      }));
    },
  });

  const requireOnline = () => {
    if (navigator.onLine) return true;
    toast.error("Staff accounts can only be changed while online.");
    return false;
  };

  const refreshStaff = async () => {
    await client.invalidateQueries({ queryKey: ["staff-management"] });
  };

  const create = async (input: CreateStaffInput) => {
    if (!requireOnline()) return false;
    setBusy(true);
    try {
      const result = await createAccount({ data: input });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      toast.success(`Staff account “${input.username}” created.`);
      await refreshStaff();
      return true;
    } catch (error) {
      toast.error(friendlyError(error, "The staff account could not be created."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateCredentials = async (row: StaffRow, username: string, password: string) => {
    if (!requireOnline()) return false;
    setBusy(true);
    try {
      const result = await saveCredentials({ data: { userId: row.id, username, password } });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      toast.success(`Username and password updated for ${row.full_name || "staff member"}.`);
      await refreshStaff();
      return true;
    } catch (error) {
      toast.error(friendlyError(error, "The credentials could not be updated."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || !requireOnline()) return;
    setBusy(true);
    try {
      const result = await deleteAccount({ data: { userId: deleteTarget.id } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Staff account deleted.");
      setDeleteTarget(null);
      await refreshStaff();
    } catch (error) {
      toast.error(friendlyError(error, "The staff account could not be deleted."));
    } finally {
      setBusy(false);
    }
  };

  const save = async (row: StaffRow, changes: Partial<Pick<StaffRow, "role" | "is_active">>) => {
    if (!isAdmin || !requireOnline()) return;
    const { error } = await supabase.rpc("admin_manage_staff", {
      p_user_id: row.id,
      p_role: changes.role ?? row.role,
      p_is_active: changes.is_active ?? row.is_active,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Staff account updated.");
    await refreshStaff();
  };

  if (!isAdmin) return <ErrorState message="Only an administrator can manage staff accounts." />;

  const accessButtons = (row: StaffRow) => {
    const isCurrent = row.id === user?.id;
    return (
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={isCurrent}
          onClick={() => setCredentialsTarget(row)}
        >
          <KeyRound className="mr-1.5 size-3.5" /> Credentials
        </Button>
        <Button
          size="sm"
          variant={row.is_active ? "outline" : "default"}
          disabled={isCurrent}
          onClick={() => void save(row, { is_active: !row.is_active })}
        >
          {row.is_active ? "Deactivate" : "Reactivate"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isCurrent}
          onClick={() => setDeleteTarget(row)}
        >
          <Trash2 className="mr-1.5 size-3.5" /> Delete
        </Button>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Staff accounts"
        description="Create usernames and passwords, assign roles, and control access from inside the clinic app."
        actions={<CreateStaffDialog busy={busy} onCreate={create} />}
      />
      <Card className="mb-5 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Administrator-controlled access</CardTitle>
          <CardDescription>
            Staff sign in with a username and password chosen here. If someone forgets their
            password, use Credentials to replace it. Staff never need the Supabase dashboard.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="p-0">
          {staff.isLoading ? (
            <div className="p-4">
              <LoadingRows />
            </div>
          ) : staff.isError ? (
            <div className="p-4">
              <ErrorState message="Staff accounts could not be loaded." />
            </div>
          ) : !staff.data?.length ? (
            <div className="p-4">
              <EmptyState title="No staff accounts" />
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {staff.data.map((row) => (
                  <div key={row.id} className="space-y-3 p-4">
                    <div>
                      <p className="font-medium">
                        {row.full_name || "Unnamed staff member"}
                        {row.id === user?.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Username: {usernameLabel(row, user?.id)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Role</p>
                        <select
                          value={row.role}
                          onChange={(event) =>
                            void save(row, { role: event.target.value as AppRole })
                          }
                          className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
                        >
                          <option value="pharmacist">Pharmacist</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="mt-2">
                          <span
                            className={
                              row.is_active
                                ? "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                                : "inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {row.is_active ? "Active" : "Deactivated"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(row.created_at)}
                    </p>
                    {accessButtons(row)}
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Staff member</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 text-right font-medium">Account controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.data.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {row.full_name || "Unnamed staff member"}
                          {row.id === user?.id ? " (you)" : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {usernameLabel(row, user?.id)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.role}
                            onChange={(event) =>
                              void save(row, { role: event.target.value as AppRole })
                            }
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                          >
                            <option value="pharmacist">Pharmacist</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              row.is_active
                                ? "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                                : "inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {row.is_active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3">{accessButtons(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" /> Only administrators can create, change or delete staff
        accounts.
      </p>

      <CredentialsDialog
        target={credentialsTarget}
        busy={busy}
        onOpenChange={(open) => !open && setCredentialsTarget(null)}
        onSave={updateCredentials}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="w-[calc(100%-1.5rem)] rounded-lg sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this staff account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.full_name || "This staff member"} will immediately lose access. Their
              past sales and audit history will remain in the clinic records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
