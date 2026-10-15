"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Preference } from "mercadopago";
import { mp } from "@/lib/mercadopago";
import { getProfile } from "@/lib/supabase/server";

export async function pay(formData: FormData) {
  const { supabase, profile } = await getProfile();
  // RLS garantiza que solo puede leer sus propias facturas
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, amount, period, status")
    .eq("id", String(formData.get("invoice_id")))
    .single();
  if (!inv || inv.status !== "pending") redirect("/cuenta");

  // Dominio del propio pedido: localhost en dev, el de Vercel en producción, sin configurar nada
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const isPublic = site.startsWith("https://"); // MP no acepta localhost en notification_url / auto_return
  const plan = Array.isArray(profile.plans) ? profile.plans[0] : profile.plans;

  let url: string | undefined;
  let detail: string | undefined;
  try {
    const pref = await new Preference(mp).create({
      body: {
        items: [{
          id: inv.id,
          title: `Internet ${plan?.name ?? ""} · ${inv.period.slice(0, 7)}`,
          quantity: 1,
          unit_price: Number(inv.amount),
          currency_id: "ARS",
        }],
        // Sin payer.email: con credenciales de prueba el comprador debe ser un usuario de prueba de MP
        external_reference: inv.id,
        back_urls: { success: `${site}/cuenta`, failure: `${site}/cuenta`, pending: `${site}/cuenta` },
        ...(isPublic && { auto_return: "approved", notification_url: `${site}/api/mercadopago/webhook` }),
      },
    });
    url = pref.init_point;
  } catch (e) {
    console.error("MercadoPago preference", e);
    // Mensaje de la API de MP (sin datos sensibles) para diagnosticar desde la página
    detail = e instanceof Error ? e.message : String(e);
  }
  // redirect fuera del try: lanza una excepción interna que no hay que capturar
  redirect(url ?? `/cuenta?status=error&detail=${encodeURIComponent(detail ?? "sin respuesta")}`);
}
