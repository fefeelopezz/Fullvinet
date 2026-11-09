"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, logAction, requireAdmin } from "@/lib/supabase/server";
import { ars } from "@/lib/utils";
import { normalizePhone } from "@/lib/whatsapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const back = async (key: "ok" | "error", msg: string) => {
  const referer = (await headers()).get("referer");
  const params = new URLSearchParams(referer ? new URL(referer).search : "");
  params.delete("ok");
  params.delete("error");
  params.set(key, msg);
  params.set("t", String(Date.now()));
  redirect(`/admin?${params}`);
};

const currentPeriod = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7) + "-01";

const METHODS = ["transferencia", "efectivo", "sin_cargo"];
const methodOf = (formData: FormData) => {
  const m = String(formData.get("payment_method") ?? "");
  return METHODS.includes(m) ? m : null;
};
const antennaOf = (formData: FormData) =>
  String(formData.get("antenna") ?? "").toUpperCase().replace(/[\s-]/g, "") || null;
const nameOf = (rel: unknown, key = "full_name") => (rel as Record<string, string> | null)?.[key] ?? "";
const phoneOf = async (formData: FormData) => {
  const raw = String(formData.get("phone") ?? "").trim();
  if (!raw) return null;
  const phone = normalizePhone(raw);
  if (!phone) await back("error", "WhatsApp inválido: poné el código de área y el número, sin 0 ni 15 (ej.: 11 2345 6789)");
  return phone;
};
const saveError = async (error: { code?: string; message: string }) =>
  await back("error", error.code === "23505" ? "Ese WhatsApp ya está asignado a otro cliente" : error.message);

export async function addClient(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const antenna = antennaOf(formData);
  const payment_method = methodOf(formData);
  const phone = await phoneOf(formData);
  const planId = Number(formData.get("plan_id"));
  if (!full_name || !planId) await back("error", "Completá nombre y plan");

  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, name, price").eq("id", planId).single();
  if (!plan) await back("error", "Plan inválido");

  const { data: client, error } = await db
    .from("profiles")
    .insert({ full_name, antenna, payment_method, phone, plan_id: plan!.id })
    .select("id")
    .single();
  if (error) await saveError(error);
  if (payment_method !== "sin_cargo") {
    const { error: invErr } = await db
      .from("invoices")
      .insert({ user_id: client!.id, period: currentPeriod(), amount: plan!.price });
    if (invErr) await back("error", invErr.message);
  }

  await logAction(me, "Agregó un cliente", `${full_name} · ${plan!.name}${antenna ? ` · antena ${antenna}` : ""}`);
  revalidatePath("/admin");
  await back("ok", `Se agregó a ${full_name}`);
}

export async function markPaid(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const ids = formData.getAll("invoice_id").map(String).filter((id) => UUID.test(id));
  if (!ids.length) await back("error", "Seleccioná al menos un cliente");

  const { data, error } = await createAdminClient()
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "pending")
    .select("period, amount, profiles(full_name)");
  if (error) await back("error", error.message);
  if (!data?.length) await back("error", "Las facturas ya estaban pagadas");
  for (const inv of data!) {
    const amount = inv.amount != null ? ` · ${ars(Number(inv.amount))}` : "";
    await logAction(me, "Marcó un pago", `${nameOf(inv.profiles)} · ${inv.period.slice(0, 7)}${amount}`);
  }
  revalidatePath("/admin");
  await back("ok", data!.length === 1 ? "Factura marcada como pagada" : `${data!.length} facturas marcadas como pagadas`);
}

export async function deleteClient(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const id = String(formData.get("user_id"));
  const db = createAdminClient();
  const { data: client } = await db.from("profiles").select("full_name, role, invoices(receipt_path)").eq("id", id).single();
  if (!client || client.role === "admin") await back("error", "No se puede dar de baja esta cuenta");

  const paths = (client!.invoices as { receipt_path: string | null }[]).flatMap((i) => (i.receipt_path ? [i.receipt_path] : []));
  if (paths.length) await db.storage.from("comprobantes").remove(paths);
  const { error } = await db.from("profiles").delete().eq("id", id);
  if (error) await back("error", error.message);
  await logAction(me, "Dio de baja un cliente", client!.full_name);
  revalidatePath("/admin");
  await back("ok", `Se dio de baja a ${client!.full_name}`);
}

export async function updateClient(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const id = String(formData.get("user_id"));
  const planId = Number(formData.get("plan_id"));
  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, name, price").eq("id", planId).single();
  if (!plan) await back("error", "Plan inválido");

  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) await back("error", "Completá el nombre");
  const { error } = await db
    .from("profiles")
    .update({
      full_name,
      plan_id: plan!.id,
      antenna: antennaOf(formData),
      payment_method: methodOf(formData),
      phone: await phoneOf(formData),
      zone_id: Number(formData.get("zone_id")) || null,
    })
    .eq("id", id);
  if (error) await saveError(error);
  const { error: invErr } = await db
    .from("invoices")
    .update({ amount: plan!.price })
    .eq("user_id", id)
    .or("status.eq.pending,amount.is.null");
  if (invErr) await back("error", invErr.message);
  if (methodOf(formData) !== "sin_cargo") {
    const { error: newErr } = await db
      .from("invoices")
      .upsert({ user_id: id, period: currentPeriod(), amount: plan!.price }, { onConflict: "user_id,period", ignoreDuplicates: true });
    if (newErr) await back("error", newErr.message);
  }
  await logAction(me, "Editó un cliente", `${full_name} · ${plan!.name}`);
  revalidatePath("/admin");
  await back("ok", `Se guardaron los cambios de ${full_name}`);
}

export async function updatePlanPrices(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const db = createAdminClient();
  const { data: plans } = await db.from("plans").select("id, name, price");
  const changes: string[] = [];
  for (const p of plans ?? []) {
    const raw = formData.get(`price_${p.id}`);
    if (raw === null) continue;
    const price = Number(String(raw).replace(/\D/g, ""));
    if (!Number.isFinite(price) || price < 0) await back("error", "Precio inválido");
    if (price === Number(p.price)) continue;
    const { error } = await db.from("plans").update({ price }).eq("id", p.id);
    if (error) await back("error", error.message);
    changes.push(`${p.name}: ${ars(Number(p.price))} → ${ars(price)}`);
  }
  if (changes.length) await logAction(me, "Cambió precios de planes", changes.join(" · "));
  revalidatePath("/admin");
  await back("ok", "Precios actualizados");
}

export async function undoPayment(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const invoiceId = String(formData.get("invoice_id"));
  const db = createAdminClient();
  const { data: inv } = await db.from("invoices").select("status, period, receipt_path, profiles(full_name)").eq("id", invoiceId).single();
  if (!inv || inv.status !== "paid") await back("error", "La factura no está pagada");
  if (inv!.receipt_path) await db.storage.from("comprobantes").remove([inv!.receipt_path]);
  const { error } = await db
    .from("invoices")
    .update({ status: "pending", paid_at: null, receipt_path: null })
    .eq("id", invoiceId)
    .eq("status", "paid");
  if (error) await back("error", error.message);
  await logAction(me, "Deshizo un pago", `${nameOf(inv!.profiles)} · ${inv!.period.slice(0, 7)}`);
  revalidatePath("/admin");
  await back("ok", "Pago deshecho: la factura volvió a pendiente");
}

const IP = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export async function addZone(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) await back("error", "Completá el nombre de la zona");
  const { error } = await createAdminClient().from("zones").insert({ name });
  if (error) await back("error", error.code === "23505" ? `La zona ${name} ya existe` : error.message);
  await logAction(me, "Agregó una zona", name);
  revalidatePath("/admin");
  await back("ok", `Zona ${name} agregada`);
}

export async function addZoneIp(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const zone_id = Number(formData.get("zone_id"));
  const ip = String(formData.get("ip") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  const kind = formData.get("kind") === "enlace" ? "enlace" : "panel";
  if (!zone_id || !IP.test(ip)) await back("error", "Ingresá una IP válida (ej.: 192.168.20.1)");
  const { data, error } = await createAdminClient().from("zone_ips").insert({ zone_id, ip, label, kind }).select("zones(name)").single();
  if (error) await back("error", error.message);
  await logAction(me, `Agregó una IP de ${kind}`, `${ip} · ${nameOf(data!.zones, "name")}`);
  revalidatePath("/admin");
  await back("ok", `IP ${ip} agregada`);
}

export async function setFree(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const id = String(formData.get("user_id"));
  const free = formData.get("free") === "1";
  const db = createAdminClient();
  const { data: client } = await db.from("profiles").select("full_name, plans(price)").eq("id", id).single();
  if (!client) await back("error", "Cliente inexistente");

  const { error } = await db.from("profiles").update({ payment_method: free ? "sin_cargo" : null }).eq("id", id);
  if (error) await back("error", error.message);
  const plan = client!.plans as unknown as { price: number } | null;
  if (!free && plan) {
    const { error: invErr } = await db
      .from("invoices")
      .upsert({ user_id: id, period: currentPeriod(), amount: plan.price }, { onConflict: "user_id,period", ignoreDuplicates: true });
    if (invErr) await back("error", invErr.message);
  }
  await logAction(me, free ? "Pasó a sin cargo" : "Pasó a con cargo", client!.full_name);
  revalidatePath("/admin");
  await back("ok", `${client!.full_name} quedó ${free ? "sin cargo" : "con cargo"}`);
}

export async function updateZoneIp(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const id = Number(formData.get("id"));
  const ip = String(formData.get("ip") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!IP.test(ip)) await back("error", "Ingresá una IP válida (ej.: 192.168.20.1)");
  const db = createAdminClient();
  const { data: old } = await db.from("zone_ips").select("ip, kind, zones(name)").eq("id", id).single();
  const { error } = await db.from("zone_ips").update({ ip, label }).eq("id", id);
  if (error) await back("error", error.message);
  if (old) await logAction(me, `Editó una IP de ${old.kind}`, `${old.ip === ip ? ip : `${old.ip} → ${ip}`} · ${nameOf(old.zones, "name")}`);
  revalidatePath("/admin");
  await back("ok", `IP ${ip} actualizada`);
}

export async function deleteZoneIp(formData: FormData) {
  const { profile: me } = await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("zone_ips")
    .delete()
    .eq("id", Number(formData.get("id")))
    .select("ip, kind, zones(name)")
    .maybeSingle();
  if (error) await back("error", error.message);
  if (data) await logAction(me, `Quitó una IP de ${data.kind}`, `${data.ip} · ${nameOf(data.zones, "name")}`);
  revalidatePath("/admin");
  await back("ok", data ? `IP ${data.ip} quitada` : "La IP ya no existía");
}
