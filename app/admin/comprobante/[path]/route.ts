import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

const notFound = () => new Response("Comprobante no encontrado", { status: 404 });

export async function GET(_req: Request, ctx: RouteContext<"/admin/comprobante/[path]">) {
  await requireAdmin();
  const { path } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(path)) return notFound();
  const { data } = await createAdminClient().storage.from("comprobantes").download(path);
  if (!data) return notFound();
  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
