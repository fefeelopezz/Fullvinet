import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/server";

export default async function Home() {
  await requireAdmin();
  redirect("/admin");
}
