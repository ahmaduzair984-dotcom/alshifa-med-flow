/**
 * All money in this app is stored and computed as integer paisa.
 * Never use floating point for financial math.
 */

export function toPaisa(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return 0;
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const paisa =
    Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2) || "0");
  return negative ? -paisa : paisa;
}

export function fromPaisa(paisa: number): number {
  return paisa / 100;
}

export function formatMoney(paisa: number, currency = "Rs."): string {
  const negative = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const formatted = rupees.toLocaleString("en-PK");
  const value = rest === 0 ? formatted : `${formatted}.${String(rest).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${currency} ${value}`;
}

export function formatMoneyPlain(paisa: number): string {
  return formatMoney(paisa, "").trim();
}

export function paisaInputValue(paisa: number): string {
  return (Math.round(paisa) / 100).toString();
}
