import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { syncInvoice, syncPayment } from "@/lib/mercadopago";
import { getProfile } from "@/lib/supabase/server";
import { ars } from "@/lib/utils";
import { logout } from "../login/actions";
import { pay } from "./actions";

// Depende del usuario logueado: puede bloquear la navegación
export const instant = false;

export default async function CuentaPage({ searchParams }: PageProps<"/cuenta">) {
  const { payment_id, status } = await searchParams;
  // Vuelta del checkout: conciliamos ya, por si el webhook todavía no llegó (o en localhost)
  if (typeof payment_id === "string" && /^\d+$/.test(payment_id)) {
    await syncPayment(payment_id).catch((e) => console.error("syncPayment", e));
  }

  const { supabase, profile } = await getProfile();
  const plan = Array.isArray(profile.plans) ? profile.plans[0] : profile.plans;
  // Pagos aprobados que no se reflejaron (cerró el checkout sin volver y sin webhook)
  const { data: unpaid } = await supabase.from("invoices").select("id").eq("status", "pending");
  await Promise.all((unpaid ?? []).map((i) => syncInvoice(i.id).catch((e) => console.error("syncInvoice", e))));

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, period, amount, status, paid_at")
    .order("period", { ascending: false });
  const pending = (invoices ?? []).filter((i) => i.status === "pending");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.email}{profile.address && ` · ${profile.address}`}
          </p>
        </div>
        <form action={logout}><Button type="submit" variant="ghost" size="sm">Salir</Button></form>
      </header>

      {status === "approved" && <p className="text-sm">¡Pago recibido! Gracias.</p>}
      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">No pudimos iniciar el pago con Mercado Pago. Probá de nuevo en unos minutos.</p>
      )}
      {(status === "rejected" || status === "failure") && (
        <p role="alert" className="text-sm text-destructive">El pago no se completó. Probá de nuevo.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Estado del servicio"><StatusBadge paid={pending.length === 0} /></Stat>
        <Stat title="Plan contratado">
          {plan?.name ?? "Sin plan"}
        </Stat>
        <Stat title="Pagás por mes">{plan ? ars(plan.price) : "—"}</Stat>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
          <CardDescription>Pagá tus facturas pendientes con Mercado Pago.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.period.slice(0, 7)}</TableCell>
                  <TableCell>{ars(i.amount)}</TableCell>
                  <TableCell><StatusBadge paid={i.status === "paid"} /></TableCell>
                  <TableCell className="text-right">
                    {i.status === "pending" && (
                      <form action={pay}>
                        <input type="hidden" name="invoice_id" value={i.id} />
                        <Button type="submit" size="sm">Pagar con Mercado Pago</Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!invoices?.length && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No hay facturas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader><CardDescription>{title}</CardDescription></CardHeader>
      <CardContent className="text-lg font-medium">{children}</CardContent>
    </Card>
  );
}
