import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlanSelect, type Plan } from "@/components/plan-select";
import { StatusBadge } from "@/components/status-badge";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { ars } from "@/lib/utils";
import { logout } from "../login/actions";
import { changePlan, deleteUser, generateInvoices } from "./actions";

type Client = {
  id: string;
  full_name: string;
  email: string;
  address: string | null;
  plan_id: number | null;
  plans: { name: string; price: number } | null;
  invoices: { status: string; period: string; amount: number }[];
};

// Depende del usuario logueado: puede bloquear la navegación
export const instant = false;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { q = "", plan = "all", estado = "all" } = (await searchParams) as Record<string, string>;
  const db = createAdminClient();

  const [{ data: plans }, { data }] = await Promise.all([
    db.from("plans").select("id, name, speed_mbps, price").order("price"),
    db.from("profiles")
      .select("id, full_name, email, address, plan_id, plans(name, price), invoices(status, period, amount)")
      .eq("role", "user")
      .order("full_name"),
  ]);
  // shortcut: trae todos los clientes y filtra en memoria; pasar los filtros a SQL si superan unos miles
  const clients = ((data ?? []) as unknown as Client[]).map((c) => {
    const last = [...c.invoices].sort((a, b) => b.period.localeCompare(a.period))[0];
    return { ...c, last, paid: c.invoices.every((i) => i.status === "paid") };
  });
  const unpaid = clients.filter((c) => !c.paid).length;

  const term = q.trim().toLowerCase();
  const rows = clients.filter(
    (c) =>
      (!term || [c.full_name, c.email, c.address ?? ""].some((v) => v.toLowerCase().includes(term))) &&
      (plan === "all" || String(c.plan_id) === plan) &&
      (estado === "all" || (estado === "paid") === c.paid),
  );

  const planItems = [{ value: "all", label: "Todos los servicios" }, ...(plans ?? []).map((p) => ({ value: String(p.id), label: p.name }))];
  const estadoItems = [
    { value: "all", label: "Todos los estados" },
    { value: "paid", label: "Pagado" },
    { value: "unpaid", label: "No pagado" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
        <div className="flex gap-2">
          <form action={generateInvoices}><Button type="submit" variant="outline" size="sm">Generar facturas del mes</Button></form>
          <form action={logout}><Button type="submit" variant="ghost" size="sm">Salir</Button></form>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Usuarios cargados" value={clients.length} />
        <Stat title="Servicio pagado" value={clients.length - unpaid} />
        <Stat title="Servicio no pagado" value={unpaid} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre, dirección o email" aria-label="Buscar cliente" className="sm:max-w-xs" />
        <FilterSelect name="plan" items={planItems} defaultValue={plan} />
        <FilterSelect name="estado" items={estadoItems} defaultValue={estado} />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Última factura</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell className="min-w-40 max-w-64 whitespace-normal">{c.address ?? "—"}</TableCell>
                  <TableCell>{c.plans ? `${c.plans.name} · ${ars(c.plans.price)}` : "—"}</TableCell>
                  <TableCell>
                    {c.last ? (
                      <>
                        <div>{ars(c.last.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.last.period.slice(0, 7)} · {c.last.status === "paid" ? "pagada" : "pendiente"}
                        </div>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge paid={c.paid} /></TableCell>
                  <TableCell className="space-x-1 text-right">
                    <EditPlan client={c} plans={plans ?? []} />
                    <DeleteUser client={c} />
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Sin resultados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader><CardDescription>{title}</CardDescription></CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function FilterSelect({ name, items, defaultValue }: { name: string; items: { value: string; label: string }[]; defaultValue: string }) {
  return (
    <Select name={name} items={items} defaultValue={defaultValue}>
      <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EditPlan({ client, plans }: { client: Client; plans: Plan[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Editar servicio</DialogTrigger>
      <DialogContent>
        <form action={changePlan} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Modificar servicio</DialogTitle>
            <DialogDescription>{client.full_name}. Las facturas pendientes se actualizan al nuevo precio.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="user_id" value={client.id} />
          <PlanSelect plans={plans} defaultValue={client.plan_id} />
          <DialogFooter>
            <DialogClose render={<Button type="submit" />}>Guardar</DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUser({ client }: { client: Client }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>Dar de baja</DialogTrigger>
      <DialogContent>
        <form action={deleteUser} className="space-y-4">
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {client.full_name}?</DialogTitle>
            <DialogDescription>Se elimina el usuario y todas sus facturas. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="user_id" value={client.id} />
          <DialogFooter showCloseButton>
            <DialogClose render={<Button type="submit" variant="destructive" />}>Dar de baja</DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
