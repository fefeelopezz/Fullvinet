"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function deleteUser(formData: FormData) {
  const { profile } = await requireAdmin();
  const id = String(formData.get("user_id"));
  if (id === profile.id) throw new Error("No podés darte de baja a vos mismo");
  // Borra el usuario de auth; profiles e invoices caen en cascada
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function changePlan(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("user_id"));
  const planId = Number(formData.get("plan_id"));
  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, price").eq("id", planId).single();
  if (!plan) throw new Error("Plan inválido");

  const { error } = await db.from("profiles").update({ plan_id: plan.id }).eq("id", id);
  if (error) throw error;
  // Lo pendiente se cobra con el plan corregido
  const { error: invErr } = await db
    .from("invoices")
    .update({ amount: plan.price })
    .eq("user_id", id)
    .eq("status", "pending");
  if (invErr) throw invErr;
  revalidatePath("/admin");
}

export async function generateInvoices() {
  await requireAdmin();
  const { error } = await createAdminClient().rpc("create_monthly_invoices");
  if (error) throw error;
  revalidatePath("/admin");
}
