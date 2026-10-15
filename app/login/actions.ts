"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const back = (tab: string, msg: string) =>
  redirect(`/login?tab=${tab}&error=${encodeURIComponent(msg)}`);

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    // El autocompletado/celular suele agregar espacios: Supabase los rechaza como credenciales inválidas
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password")),
  });
  if (error) {
    back("login", error.code === "email_not_confirmed"
      ? "Tu cuenta todavía no está confirmada. Escribinos por WhatsApp y la activamos."
      : error.code === "invalid_credentials" ? "Email o contraseña incorrectos" : error.message);
  }
  // Cambió la sesión: descarta páginas cacheadas del usuario anterior
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const plan_id = String(formData.get("plan_id") ?? "");
  if (!full_name || !address || !/^\d+$/.test(plan_id)) back("signup", "Completá nombre, dirección y plan");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) back("signup", "La contraseña debe tener al menos 6 caracteres");

  // Sin email de confirmación (no hay proveedor de correo): la cuenta se crea ya confirmada.
  // El trigger on_auth_user_created crea el perfil y la factura del mes.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, address, plan_id },
  });
  if (error) {
    back("signup", error.code === "email_exists" ? "Ya existe una cuenta con ese email" : error.message);
  }

  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) back("login", "Cuenta creada. Ingresá con tu email y contraseña.");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
