export type NoticeKind = "antes" | "vencimiento";

const DUE_DAY = 30;
const DAYS_BEFORE = 3;
const DAY_MS = 86_400_000;

export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  return /^\d{10}$/.test(d) ? `549${d}` : null;
}

export function dueDate(period: string) {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period.slice(0, 7)}-${String(Math.min(DUE_DAY, lastDay)).padStart(2, "0")}`;
}

export function noticeFor(period: string, today: string): NoticeKind | null {
  const daysLeft = (Date.parse(dueDate(period)) - Date.parse(today)) / DAY_MS;
  if (daysLeft === 0) return "vencimiento";
  if (daysLeft > 0 && daysLeft <= DAYS_BEFORE) return "antes";
  return null;
}

export function noticeParams(kind: NoticeKind, name: string, period: string, amount: number) {
  const month = new Date(`${period.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  const due = new Date(`${dueDate(period)}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
  return [name, month, money, kind === "vencimiento" ? "hoy" : `el ${due}`];
}

export function reminderText(name: string, period: string, amount: number, today: string) {
  const due = dueDate(period);
  const [, , money] = noticeParams("antes", name, period, amount);
  const day = `${due.slice(8)}/${due.slice(5, 7)}`;
  const when = today === due ? "vence hoy" : today > due ? `venció el ${day}` : `vence el ${day}`;
  return `Hola ${name}, te recordamos que tu factura de internet Fullvinet por ${money} ${when}. ¡Gracias!`;
}

export function reminderLink(phone: string | null, text: string) {
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}

export async function sendTemplate(phone: string, params: string[]) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es_AR" },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
}
