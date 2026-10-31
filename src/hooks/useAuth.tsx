import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/pharmacy";
import { isNetworkFailure } from "@/lib/offline-queue";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isPharmacist: boolean;
  can: (capability: Capability) => boolean;
  fullName: string;
  refresh: () => Promise<void>;
};

export type Capability =
  | "sell"
  | "sell_labs"
  | "manage_labs"
  | "manage_catalog"
  | "manage_stock"
  | "manage_purchases"
  | "manage_expenses"
  | "view_reports"
  | "manage_users"
  | "view_audit"
  | "manage_settings";

const CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    "sell",
    "sell_labs",
    "manage_labs",
    "manage_catalog",
    "manage_stock",
    "manage_purchases",
    "manage_expenses",
    "view_reports",
    "manage_users",
    "view_audit",
    "manage_settings",
  ],
  manager: [
    "sell_labs",
    "manage_labs",
    "manage_catalog",
    "manage_stock",
    "manage_purchases",
    "manage_expenses",
    "view_reports",
  ],
  pharmacist: ["sell", "sell_labs"],
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedProfile(userId: string) {
  try {
    const value = localStorage.getItem(`al-shifa-profile:${userId}`);
    return value ? (JSON.parse(value) as { roles: AppRole[]; fullName: string }) : null;
  } catch {
    return null;
  }
}

function saveCachedProfile(userId: string, roles: AppRole[], fullName: string) {
  try {
    localStorage.setItem(`al-shifa-profile:${userId}`, JSON.stringify({ roles, fullName }));
  } catch {
    // The live profile still works when private browser storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setFullName("");
      return;
    }
    const cached = readCachedProfile(userId);
    if (!navigator.onLine) {
      setRoles(cached?.roles ?? []);
      setFullName(cached?.fullName ?? "");
      return;
    }
    const [roleResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, is_active").eq("id", userId).maybeSingle(),
    ]);
    if (roleResult.error || profileResult.error) {
      const error = roleResult.error ?? profileResult.error;
      if (isNetworkFailure(error)) {
        setRoles(cached?.roles ?? []);
        setFullName(cached?.fullName ?? "");
      }
      return;
    }
    if (profileResult.data?.is_active === false) {
      setRoles([]);
      setFullName("");
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    const nextRoles = (roleResult.data ?? []).map((row) => row.role as AppRole);
    const nextName = profileResult.data?.full_name ?? "";
    setRoles(nextRoles);
    setFullName(nextName);
    saveCachedProfile(userId, nextRoles, nextName);
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      void loadProfile(nextSession?.user?.id);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const allowed = new Set<Capability>();
    roles.forEach((role) => CAPABILITIES[role]?.forEach((c) => allowed.add(c)));
    return {
      user: session?.user ?? null,
      session,
      roles,
      loading,
      isAdmin: roles.includes("admin"),
      isManager: roles.includes("manager"),
      isPharmacist: roles.includes("pharmacist"),
      can: (capability) => allowed.has(capability),
      fullName,
      refresh: async () => loadProfile(session?.user?.id),
    };
  }, [session, roles, loading, fullName]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
