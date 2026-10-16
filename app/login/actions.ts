"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const back = (msg: string) => redirect(`/login?error=${encodeURIComponent(msg)}`);

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password")),
  });
  if (error) back(error.code === "invalid_credentials" ? "Email o contraseña incorrectos" : error.message);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user!.id).single();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    back("Solo el administrador puede ingresar");
  }
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
