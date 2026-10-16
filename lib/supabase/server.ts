import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
          }
        },
      },
    },
  );
}

export function createAdminClient() {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

export async function getProfile() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, address, role, plan_id, plans(name, speed_mbps, price)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return { supabase, profile };
}

export async function requireAdmin() {
  const ctx = await getProfile();
  if (ctx.profile.role !== "admin") redirect(`/login?error=${encodeURIComponent("Solo el administrador puede ingresar")}`);
  return ctx;
}
