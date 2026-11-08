import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { noticeFor, noticeParams, sendTemplate } from "@/lib/whatsapp";

type Row = { id: string; period: string; amount: number | null; profiles: { full_name: string; phone: string; payment_method: string | null } };

const authorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return !!secret && got.length === want.length && timingSafeEqual(got, want);
};

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const db = createAdminClient();

  const { data, error } = await db
    .from("invoices")
    .select("id, period, amount, profiles!inner(full_name, phone, payment_method)")
    .eq("status", "pending")
    .not("profiles.phone", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const due = (data as unknown as Row[]).flatMap((inv) => {
    const kind = noticeFor(inv.period, today);
    return kind && inv.amount != null && inv.profiles.payment_method !== "sin_cargo" ? [{ inv, kind }] : [];
  });
  const { data: sent } = due.length
    ? await db.from("whatsapp_notices").select("invoice_id, kind").in("invoice_id", due.map((d) => d.inv.id))
    : { data: [] };
  const already = new Set((sent ?? []).map((s) => `${s.invoice_id}:${s.kind}`));

  const result = { enviados: 0, errores: [] as string[] };
  for (const { inv, kind } of due) {
    if (already.has(`${inv.id}:${kind}`)) continue;
    try {
      await sendTemplate(inv.profiles.phone, noticeParams(kind, inv.profiles.full_name, inv.period, Number(inv.amount)));
      await db.from("whatsapp_notices").insert({ invoice_id: inv.id, kind });
      result.enviados++;
    } catch (e) {
      result.errores.push(`${inv.profiles.full_name}: ${(e as Error).message}`);
    }
  }
  return Response.json(result);
}
