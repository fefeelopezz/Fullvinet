"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function addClient(formData: FormData) {
  await requireAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const address = String(formData.get("address") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const plan_id = String(formData.get("plan_id") ?? "");

  let error: string | undefined;
  if (!full_name || !address || !/^\S+@\S+\.\S+$/.test(email) || !/^\d+$/.test(plan_id)) {
    error = "Completá nombre, email válido, dirección y plan";
  } else if (password.length < 8) {
    error = "La contraseña debe tener al menos 8 caracteres";
  } else {
    // El trigger on_auth_user_created crea el perfil y la factura del mes
    const res = await createAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, address, plan_id },
    });
    if (res.error) error = res.error.message;
    const antenna = String(formData.get("antenna") ?? "").trim();
    if (!res.error && antenna) {
      await createAdminClient().from("profiles").update({ antenna }).eq("id", res.data.user.id);
    }
  }

  revalidatePath("/admin");
  redirect(error ? `/admin?error=${encodeURIComponent(error)}` : `/admin?ok=${encodeURIComponent(`Se agregó a ${full_name}`)}`);
}

// Pago en efectivo: sin mp_payment_id, así se distingue de un pago por Mercado Pago
export async function markPaid(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", String(formData.get("invoice_id")))
    .eq("status", "pending");
  if (error) throw error;
  revalidatePath("/admin");
}

export async function deleteUser(formData: FormData) {
  const { profile } = await requireAdmin();
  const id = String(formData.get("user_id"));
  if (id === profile.id) throw new Error("No podés darte de baja a vos mismo");
  // Borra el usuario de auth; profiles e invoices caen en cascada
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function updateClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("user_id"));
  const planId = Number(formData.get("plan_id"));
  const password = String(formData.get("password") ?? "");
  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id, price").eq("id", planId).single();
  if (!plan) redirect(`/admin?error=${encodeURIComponent("Plan inválido")}`);
  if (password && password.length < 8) {
    redirect(`/admin?error=${encodeURIComponent("La contraseña debe tener al menos 8 caracteres")}`);
  }
  // Las contraseñas están hasheadas: no se pueden ver, solo reemplazar
  if (password) {
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  const antenna = String(formData.get("antenna") ?? "").trim() || null;
  const { error } = await db.from("profiles").update({ plan_id: plan.id, antenna }).eq("id", id);
  if (error) throw error;
  // Lo pendiente se cobra con el plan corregido
  const { error: invErr } = await db
    .from("invoices")
    .update({ amount: plan.price })
    .eq("user_id", id)
    .eq("status", "pending");
  if (invErr) throw invErr;
  revalidatePath("/admin");
  if (password) redirect(`/admin?ok=${encodeURIComponent("Contraseña actualizada")}`);
}
