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
            // Llamado desde un Server Component: proxy.ts ya refresca la sesión.
          }
        },
      },
    },
  );
}

// Salta RLS. Usar solo después de verificar permisos en el servidor.
export function createAdminClient() {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// Planes son públicos y casi no cambian: cacheados, sin cookies
export async function getPlans() {
  "use cache";
  const { data } = await createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  ).from("plans").select("id, name, speed_mbps, price").order("price");
  return data ?? [];
}

export async function getProfile() {
  await connection(); // el cliente de auth usa Date.now(): renderizar solo por request
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
  if (ctx.profile.role !== "admin") redirect("/cuenta");
  return ctx;
}
