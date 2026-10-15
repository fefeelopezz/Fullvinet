import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlanSelect, type Plan } from "@/components/plan-select";
import { StatusBadge } from "@/components/status-badge";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { ars } from "@/lib/utils";
import { logout } from "../login/actions";
import { addClient, deleteUser, markPaid, updateClient } from "./actions";

type Client = {
  id: string;
  full_name: string;
  email: string;
  address: string | null;
  antenna: string | null;
  plan_id: number | null;
  plans: { name: string; price: number } | null;
  invoices: { id: string; status: string; period: string; amount: number }[];
};

// Depende del usuario logueado: puede bloquear la navegación
export const instant = false;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { q = "", plan = "all", estado = "all", mes = "all", error, ok } = (await searchParams) as Record<string, string>;
  const db = createAdminClient();

  const [{ data: plans }, { data }, { data: authData }] = await Promise.all([
    db.from("plans").select("id, name, speed_mbps, price").order("price"),
    db.from("profiles")
      .select("id, full_name, email, address, antenna, plan_id, plans(name, price), invoices(id, status, period, amount)")
      .eq("role", "user")
      .order("full_name"),
    // shortcut: una sola página de 1000 usuarios de auth, paginar si se superan
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const authById = new Map((authData?.users ?? []).map((u) => [u.id, u]));
  // shortcut: trae todos los clientes y filtra en memoria; pasar los filtros a SQL si superan unos miles
  const all = (data ?? []) as unknown as Client[];
  // Con mes elegido: la factura de ese mes decide el estado; sin mes, la última y si debe alguna
  const clients = all.flatMap((c) => {
    const sorted = [...c.invoices].sort((a, b) => b.period.localeCompare(a.period));
    const last = mes === "all" ? sorted[0] : sorted.find((i) => i.period.startsWith(mes));
    if (mes !== "all" && !last) return [];
    const paid = mes === "all" ? c.invoices.every((i) => i.status === "paid") : last?.status === "paid";
    return [{ ...c, last, paid }];
  });
  const unpaid = clients.filter((c) => !c.paid).length;

  const term = q.trim().toLowerCase();
  const rows = clients.filter(
    (c) =>
      (!term || [c.full_name, c.email, c.address ?? "", c.antenna ?? ""].some((v) => v.toLowerCase().includes(term))) &&
      (plan === "all" || String(c.plan_id) === plan) &&
      (estado === "all" || (estado === "paid") === c.paid),
  );

  const planItems = [{ value: "all", label: "Todos los servicios" }, ...(plans ?? []).map((p) => ({ value: String(p.id), label: p.name }))];
  const months = [...new Set(all.flatMap((c) => c.invoices.map((i) => i.period.slice(0, 7))))].sort().reverse();
  const mesItems = [
    { value: "all", label: "Todos los meses" },
    ...months.map((m) => ({
      value: m,
      label: new Date(`${m}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    })),
  ];
  const estadoItems = [
    { value: "all", label: "Todos los estados" },
    { value: "paid", label: "Pagado" },
    { value: "unpaid", label: "No pagado" },
  ];

  return (
    <main className="mx-auto w-full max-w-[90rem] space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
        <div className="flex flex-wrap gap-2">
          {/* key: tras guardar cambia la URL (ok/error) y el diálogo se vuelve a montar cerrado */}
          <AddClient key={ok ?? error ?? ""} plans={plans ?? []} />
          <form action={logout}><Button type="submit" variant="ghost" size="sm">Salir</Button></form>
        </div>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {ok && <p role="status" className="text-sm text-primary">{ok}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Usuarios cargados" value={clients.length} />
        <Stat title="Servicio pagado" value={clients.length - unpaid} />
        <Stat title="Servicio no pagado" value={unpaid} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre, antena, dirección o email" aria-label="Buscar cliente" className="sm:max-w-xs" />
        <FilterSelect name="plan" items={planItems} defaultValue={plan} />
        <FilterSelect name="mes" items={mesItems} defaultValue={mes} />
        <FilterSelect name="estado" items={estadoItems} defaultValue={estado} />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Antena</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>{mes === "all" ? "Última factura" : "Factura del mes"}</TableHead>
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
                  <TableCell className="font-mono">{c.antenna ?? "—"}</TableCell>
                  <TableCell className="min-w-32 max-w-64 whitespace-normal">{c.address ?? "—"}</TableCell>
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge paid={c.paid} />
                      {c.last?.status === "pending" && (
                        <form action={markPaid}>
                          <input type="hidden" name="invoice_id" value={c.last.id} />
                          <Button type="submit" variant="secondary" size="xs">Marcar pagada</Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <EditPlan
                      client={c}
                      plans={plans ?? []}
                      createdAt={authById.get(c.id)?.created_at}
                      lastSignIn={authById.get(c.id)?.last_sign_in_at}
                    />
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

function AddClient({ plans }: { plans: Plan[] }) {
  const fields = [
    { name: "full_name", label: "Nombre completo" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Dirección del servicio" },
    { name: "antenna", label: "Número de antena (opcional)", required: false },
    { name: "password", label: "Contraseña inicial", type: "password", minLength: 8 },
  ];
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>Agregar cliente</DialogTrigger>
      <DialogContent>
        <form action={addClient} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Agregar cliente</DialogTitle>
            <DialogDescription>Se crea la cuenta con el email confirmado y la factura del mes.</DialogDescription>
          </DialogHeader>
          {fields.map(({ name, label, ...props }) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={`new-${name}`}>{label}</Label>
              <Input id={`new-${name}`} name={name} required {...props} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <PlanSelect plans={plans} />
          </div>
          <DialogFooter>
            <Button type="submit">Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlan({ client, plans, createdAt, lastSignIn }: { client: Client; plans: Plan[]; createdAt?: string; lastSignIn?: string }) {
  const fecha = (d?: string) => (d ? new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Nunca");
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Editar</DialogTrigger>
      <DialogContent>
        <form action={updateClient} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{client.full_name}</DialogTitle>
            <DialogDescription>Si cambiás el plan, las facturas pendientes se actualizan al nuevo precio.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd className="break-all">{client.email}</dd>
            <dt className="text-muted-foreground">Dirección</dt><dd>{client.address ?? "—"}</dd>
            <dt className="text-muted-foreground">Alta</dt><dd>{fecha(createdAt)}</dd>
            <dt className="text-muted-foreground">Último ingreso</dt><dd>{fecha(lastSignIn)}</dd>
          </dl>
          <input type="hidden" name="user_id" value={client.id} />
          <div className="space-y-1.5">
            <Label htmlFor={`antenna-${client.id}`}>Número de antena</Label>
            <Input id={`antenna-${client.id}`} name="antenna" defaultValue={client.antenna ?? ""} placeholder="Ej.: A-102" />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <PlanSelect plans={plans} defaultValue={client.plan_id} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`password-${client.id}`}>Nueva contraseña</Label>
            <Input id={`password-${client.id}`} name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Dejar vacío para no cambiarla" />
            <p className="text-xs text-muted-foreground">Por seguridad las contraseñas no se pueden ver, solo reemplazar.</p>
          </div>
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
