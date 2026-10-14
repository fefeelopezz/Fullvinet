import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";

export default async function Home() {
  const { profile } = await getProfile();
  redirect(profile.role === "admin" ? "/admin" : "/cuenta");
}
