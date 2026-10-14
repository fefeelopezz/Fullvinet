"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const back = (tab: string, msg: string) =>
  redirect(`/login?tab=${tab}&error=${encodeURIComponent(msg)}`);

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) back("login", "Email o contraseña incorrectos");
  // Cambió la sesión: descarta páginas cacheadas del usuario anterior
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const plan_id = String(formData.get("plan_id") ?? "");
  if (!full_name || !address || !/^\d+$/.test(plan_id)) back("signup", "Completá nombre, dirección y plan");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: { data: { full_name, address, plan_id } },
  });
  if (error) back("signup", error.message);
  // Con confirmación de email activa no hay sesión todavía
  revalidatePath("/", "layout");
  if (!data.session) redirect(`/login?msg=${encodeURIComponent("Revisá tu email para confirmar la cuenta")}`);
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
