import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const DB_NAME = "al-shifa-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "mutations";
const CACHE_STORE = "cache";
const QUEUE_EVENT = "al-shifa-offline-queue-change";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type PatientInsert = Database["public"]["Tables"]["patients"]["Insert"];
type PatientUpdate = Database["public"]["Tables"]["patients"]["Update"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];
type SaleArgs = Database["public"]["Functions"]["create_sale"]["Args"];
type PurchaseArgs = Database["public"]["Functions"]["create_purchase"]["Args"];
type LabSaleArgs = Database["public"]["Functions"]["create_lab_sale"]["Args"];

export type OfflineMutationKind =
  | "create_sale"
  | "create_purchase"
  | "create_lab_sale"
  | "insert_product"
  | "update_product"
  | "insert_patient"
  | "update_patient"
  | "insert_supplier"
  | "insert_expense"
  | "update_expense";

export type OfflineMutation = {
  id: string;
  userId: string;
  kind: OfflineMutationKind;
  label: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  status: "pending" | "failed";
  lastError?: string;
};

type CachedValue<T = unknown> = {
  key: string;
  value: T;
  updatedAt: string;
};

type ExecutionResult = { data: unknown; error: unknown | null };

export type OfflineMutationResult = ExecutionResult & {
  queued: boolean;
};

export type OfflineQueueSummary = {
  pending: number;
  failed: number;
  total: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let activeSync: Promise<{ synced: number; summary: OfflineQueueSummary }> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage is unavailable."));
  });
  return databasePromise;
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage operation failed."));
  });
}

async function storeValue(storeName: string, value: unknown) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  await requestValue(transaction.objectStore(storeName).put(value));
}

async function deleteValue(storeName: string, key: string) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  await requestValue(transaction.objectStore(storeName).delete(key));
}

function notifyQueueChanged() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message).slice(0, 240);
  }
  return "The saved change could not be synchronized.";
}

export function isNetworkFailure(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = errorMessage(error);
  return /failed to fetch|fetch failed|network|offline|connection|load failed|timeout/i.test(
    message,
  );
}

export async function getOfflineQueue() {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readonly");
  const rows = (await requestValue(
    transaction.objectStore(QUEUE_STORE).getAll(),
  )) as OfflineMutation[];
  const dependencyPriority: Record<OfflineMutationKind, number> = {
    insert_product: 0,
    insert_patient: 0,
    insert_supplier: 0,
    update_product: 1,
    update_patient: 1,
    update_expense: 1,
    insert_expense: 0,
    create_purchase: 2,
    create_sale: 2,
    create_lab_sale: 2,
  };
  return rows.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      dependencyPriority[a.kind] - dependencyPriority[b.kind] ||
      a.id.localeCompare(b.id),
  );
}

export async function getOfflineQueueSummary(): Promise<OfflineQueueSummary> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return { pending: 0, failed: 0, total: 0 };
  const rows = (await getOfflineQueue()).filter((row) => row.userId === userId);
  const pending = rows.filter((row) => row.status === "pending").length;
  const failed = rows.length - pending;
  return { pending, failed, total: rows.length };
}

async function enqueue(item: OfflineMutation) {
  await storeValue(QUEUE_STORE, item);
  notifyQueueChanged();
}

async function executeMutation(item: OfflineMutation): Promise<ExecutionResult> {
  switch (item.kind) {
    case "create_sale": {
      const response = await supabase.rpc("create_sale", item.payload as SaleArgs);
      return { data: response.data, error: response.error };
    }
    case "create_purchase": {
      const args = item.payload as PurchaseArgs;
      const replayToken = typeof args.p_note === "string" ? args.p_note : "";
      if (replayToken.startsWith("offline-client:")) {
        const existing = await supabase
          .from("purchases")
          .select("id")
          .eq("note", replayToken)
          .maybeSingle();
        if (existing.error) return { data: null, error: existing.error };
        if (existing.data)
          return { data: { purchase_id: existing.data.id, duplicate: true }, error: null };
      }
      const response = await supabase.rpc("create_purchase", args);
      return { data: response.data, error: response.error };
    }
    case "create_lab_sale": {
      const response = await supabase.rpc("create_lab_sale", item.payload as LabSaleArgs);
      return { data: response.data, error: response.error };
    }
    case "insert_product": {
      const record = item.payload as ProductInsert;
      if (record.id) {
        const existing = await supabase
          .from("products")
          .select("id")
          .eq("id", record.id)
          .maybeSingle();
        if (existing.error) return { data: null, error: existing.error };
        if (existing.data) return { data: existing.data, error: null };
      }
      const response = await supabase.from("products").insert(record).select("id").maybeSingle();
      return { data: response.data, error: response.error };
    }
    case "update_product": {
      const payload = item.payload as { id: string; values: ProductUpdate };
      const response = await supabase.from("products").update(payload.values).eq("id", payload.id);
      return { data: response.data, error: response.error };
    }
    case "insert_patient": {
      const record = item.payload as PatientInsert;
      if (record.id) {
        const existing = await supabase
          .from("patients")
          .select("id")
          .eq("id", record.id)
          .maybeSingle();
        if (existing.error) return { data: null, error: existing.error };
        if (existing.data) return { data: existing.data, error: null };
      }
      const response = await supabase.from("patients").insert(record).select("id").maybeSingle();
      return { data: response.data, error: response.error };
    }
    case "update_patient": {
      const payload = item.payload as { id: string; values: PatientUpdate };
      const response = await supabase.from("patients").update(payload.values).eq("id", payload.id);
      return { data: response.data, error: response.error };
    }
    case "insert_supplier": {
      const record = item.payload as SupplierInsert;
      if (record.id) {
        const existing = await supabase
          .from("suppliers")
          .select("id")
          .eq("id", record.id)
          .maybeSingle();
        if (existing.error) return { data: null, error: existing.error };
        if (existing.data) return { data: existing.data, error: null };
      }
      const response = await supabase.from("suppliers").insert(record).select("id").maybeSingle();
      return { data: response.data, error: response.error };
    }
    case "insert_expense": {
      const record = item.payload as ExpenseInsert;
      if (record.id) {
        const existing = await supabase
          .from("expenses")
          .select("id")
          .eq("id", record.id)
          .maybeSingle();
        if (existing.error) return { data: null, error: existing.error };
        if (existing.data) return { data: existing.data, error: null };
      }
      const response = await supabase.from("expenses").insert(record).select("id").maybeSingle();
      return { data: response.data, error: response.error };
    }
    case "update_expense": {
      const payload = item.payload as { id: string; values: ExpenseUpdate };
      const response = await supabase.from("expenses").update(payload.values).eq("id", payload.id);
      return { data: response.data, error: response.error };
    }
  }
}

export async function runOrQueueMutation(input: {
  kind: OfflineMutationKind;
  label: string;
  payload: unknown;
}): Promise<OfflineMutationResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return {
      data: null,
      error: new Error("Please sign in again before saving this change."),
      queued: false,
    };
  }
  const item: OfflineMutation = {
    ...input,
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };

  if (!navigator.onLine) {
    await enqueue(item);
    return { data: null, error: null, queued: true };
  }

  try {
    const result = await executeMutation(item);
    if (!result.error) return { ...result, queued: false };
    if (!isNetworkFailure(result.error)) return { ...result, queued: false };
  } catch (error) {
    if (!isNetworkFailure(error)) return { data: null, error, queued: false };
  }

  await enqueue(item);
  return { data: null, error: null, queued: true };
}

async function performSync() {
  let synced = 0;
  if (!navigator.onLine) return { synced, summary: await getOfflineQueueSummary() };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { synced, summary: { pending: 0, failed: 0, total: 0 } };
  const rows = (await getOfflineQueue()).filter((row) => row.userId === userId);
  for (const item of rows) {
    try {
      const result = await executeMutation(item);
      if (!result.error) {
        await deleteValue(QUEUE_STORE, item.id);
        synced += 1;
        notifyQueueChanged();
        continue;
      }
      if (isNetworkFailure(result.error)) break;
      await enqueue({
        ...item,
        attempts: item.attempts + 1,
        status: "failed",
        lastError: errorMessage(result.error),
      });
    } catch (error) {
      if (isNetworkFailure(error)) break;
      await enqueue({
        ...item,
        attempts: item.attempts + 1,
        status: "failed",
        lastError: errorMessage(error),
      });
    }
  }
  return { synced, summary: await getOfflineQueueSummary() };
}

export async function syncOfflineQueue() {
  if (activeSync) return activeSync;
  const sync = async () => {
    if (navigator.locks) {
      const result = await navigator.locks.request(
        "al-shifa-offline-sync",
        { ifAvailable: true },
        async (lock) =>
          lock ? performSync() : { synced: 0, summary: await getOfflineQueueSummary() },
      );
      return result;
    }
    return performSync();
  };
  activeSync = sync().finally(() => {
    activeSync = null;
  });
  return activeSync;
}

export function subscribeOfflineQueue(listener: () => void) {
  window.addEventListener(QUEUE_EVENT, listener);
  return () => window.removeEventListener(QUEUE_EVENT, listener);
}

async function readCache<T>(key: string) {
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, "readonly");
  const row = (await requestValue(transaction.objectStore(CACHE_STORE).get(key))) as
    CachedValue<T> | undefined;
  return row?.value;
}

export async function cachedQuery<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const scopedKey = `${sessionData.session?.user.id ?? "signed-out"}:${key}`;
  if (!navigator.onLine) {
    const cached = await readCache<T>(scopedKey);
    if (cached !== undefined) return cached;
    throw new Error(
      "This information has not been saved on this device yet. Open this page once while online.",
    );
  }
  try {
    const value = await loader();
    await storeValue(CACHE_STORE, {
      key: scopedKey,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies CachedValue<T>);
    return value;
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const cached = await readCache<T>(scopedKey);
    if (cached !== undefined) return cached;
    throw error;
  }
}
