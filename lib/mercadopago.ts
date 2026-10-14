import "server-only";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/server";

export const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

// Marca la factura como pagada consultando el pago a la API de MP (nunca confiamos en el cliente).
// Idempotente: lo usan el webhook y la vuelta del checkout.
export async function syncPayment(paymentId: string) {
  const p = await new Payment(mp).get({ id: paymentId });
  if (p.status !== "approved" || p.currency_id !== "ARS" || !p.external_reference) return;

  const db = createAdminClient();
  const { data: inv } = await db.from("invoices").select("amount").eq("id", p.external_reference).single();
  if (!inv || Number(p.transaction_amount) < Number(inv.amount)) return;

  const { error } = await db
    .from("invoices")
    .update({ status: "paid", mp_payment_id: String(p.id), paid_at: p.date_approved ?? new Date().toISOString() })
    .eq("id", p.external_reference)
    .eq("status", "pending");
  if (error) throw error;
}
