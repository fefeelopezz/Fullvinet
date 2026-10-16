"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

const MAX_PDF = 4 * 1024 * 1024;
const back = (key: "ok" | "error", msg: string) => redirect(`/admin?${key}=${encodeURIComponent(msg)}`);

// Primer día del mes en curso, en hora de Argentina (formato de invoices.period)
const currentPeriod = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7) + "-01";

// Clientes sin login: solo datos del servicio. Se crea con la factura del mes.
export async function addClient(formData: FormData) {
  await requireAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const antenna = String(formData.get("antenna") ?? "").trim() || null;
  const planId = Number(formData.get("plan_id"));
  if (!full_name || !address || !planId) back("error", "Completá nombre, dirección y plan");

  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, price").eq("id", planId).single();
  if (!plan) back("error", "Plan inválido");

  const { data: client, error } = await db
    .from("profiles")
    .insert({ full_name, address, antenna, plan_id: plan!.id })
    .select("id")
    .single();
  if (error) back("error", error.message);
  const { error: invErr } = await db
    .from("invoices")
    .insert({ user_id: client!.id, period: currentPeriod(), amount: plan!.price });
  if (invErr) back("error", invErr.message);

  revalidatePath("/admin");
  back("ok", `Se agregó a ${full_name}`);
}

// Pago por WhatsApp/efectivo: se marca a mano y opcionalmente se adjunta el comprobante en PDF
export async function markPaid(formData: FormData) {
  await requireAdmin();
  const invoiceId = String(formData.get("invoice_id"));
  const file = formData.get("receipt");
  const db = createAdminClient();

  const { data: inv } = await db.from("invoices").select("id, status").eq("id", invoiceId).single();
  if (!inv || inv.status !== "pending") back("error", "La factura no existe o ya estaba pagada");

  let receipt_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) back("error", "El comprobante supera los 4 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Validamos el contenido, no solo la extensión: todo PDF empieza con "%PDF"
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") back("error", "El comprobante tiene que ser un PDF");
    receipt_path = `${invoiceId}.pdf`;
    const { error } = await db.storage
      .from("comprobantes")
      .upload(receipt_path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) back("error", `No se pudo subir el comprobante: ${error.message}`);
  }

  const { error } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), receipt_path })
    .eq("id", invoiceId)
    .eq("status", "pending");
  if (error) back("error", error.message);
  revalidatePath("/admin");
  back("ok", receipt_path ? "Factura pagada con comprobante" : "Factura marcada como pagada");
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("user_id"));
  const db = createAdminClient();
  const { data: client } = await db.from("profiles").select("role, invoices(receipt_path)").eq("id", id).single();
  if (!client || client.role === "admin") back("error", "No se puede dar de baja esta cuenta");

  // Primero los PDF (no tienen cascada); después el cliente, y sus facturas caen en cascada
  const paths = (client!.invoices as { receipt_path: string | null }[]).flatMap((i) => (i.receipt_path ? [i.receipt_path] : []));
  if (paths.length) await db.storage.from("comprobantes").remove(paths);
  const { error } = await db.from("profiles").delete().eq("id", id);
  if (error) back("error", error.message);
  revalidatePath("/admin");
}

export async function updateClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("user_id"));
  const planId = Number(formData.get("plan_id"));
  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, price").eq("id", planId).single();
  if (!plan) back("error", "Plan inválido");

  const antenna = String(formData.get("antenna") ?? "").trim() || null;
  const { error } = await db.from("profiles").update({ plan_id: plan!.id, antenna }).eq("id", id);
  if (error) back("error", error.message);
  // Lo pendiente se cobra con el plan corregido
  const { error: invErr } = await db
    .from("invoices")
    .update({ amount: plan!.price })
    .eq("user_id", id)
    .eq("status", "pending");
  if (invErr) back("error", invErr.message);
  revalidatePath("/admin");
}
