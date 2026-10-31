type MedicineIdentity = {
  brand_name?: unknown;
  strength?: unknown;
};

function normalizeMedicineName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isRetiredMedicine(medicine: MedicineIdentity) {
  const identity = normalizeMedicineName(`${medicine.brand_name ?? ""} ${medicine.strength ?? ""}`);

  return identity.includes("veunax05mg");
}
