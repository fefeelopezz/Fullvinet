import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlanSelect, type Plan } from "@/components/plan-select";
import { StatusBadge } from "@/components/status-badge";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ars } from "@/lib/utils";
import { logout } from "../login/actions";
import { addClient, deleteClient, markPaid, updateClient } from "./actions";

type Invoice = { id: string; status: string; period: string; amount: number | null; paid_at: string | null; receipt_path: string | null };
type Client = {
  id: string;
  full_name: string;
  email: string | null;
  antenna: string | null;
  payment_method: "transferencia" | "efectivo" | "sin_cargo" | null;
  plan_id: number | null;
  created_at: string;
  plans: { name: string; price: number } | null;
  invoices: Invoice[];
};

export const instant = false;

const METHOD_LABEL = { transferencia: "Transferencia", efectivo: "Efectivo", sin_cargo: "Sin cargo" } as const;

const monto = (amount: number | null) => (amount == null ? "Sin plan" : ars(amount));

function antennaUrl(antenna: string | null) {
  const m = antenna?.toUpperCase().replace(/[\s-]/g, "").match(/^([AB]?)(\d+)$/);
  if (!m) return null;
  const subnet = m[1] === "A" ? 21 : m[1] === "B" ? 24 : 20;
  return `http://192.168.${subnet}.${Number(m[2])}`;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { q = "", plan = "all", estado = "all", mes = "all", error, ok } = (await searchParams) as Record<string, string>;
  const db = createAdminClient();

  const [{ data: plans }, { data }] = await Promise.all([
    db.from("plans").select("id, name, speed_mbps, price").order("price"),
    db.from("profiles")
      .select("id, full_name, email, antenna, payment_method, plan_id, created_at, plans(name, price), invoices(id, status, period, amount, paid_at, receipt_path)")
      .eq("role", "user")
      .order("full_name"),
  ]);
  const all = (data ?? []) as unknown as Client[];
  const clients = all.flatMap((c) => {
    const sorted = [...c.invoices].sort((a, b) => b.period.localeCompare(a.period));
    const last = mes === "all" ? sorted[0] : sorted.find((i) => i.period.startsWith(mes));
    if (mes !== "all" && !last) return [];
    const paid = mes === "all" ? c.invoices.every((i) => i.status === "paid") : last?.status === "paid";
    return [{ ...c, last, paid, free: c.payment_method === "sin_cargo" }];
  });
  const billable = clients.filter((c) => !c.free);
  const unpaid = billable.filter((c) => !c.paid).length;

  const term = q.trim().toLowerCase();
  const rows = clients.filter(
    (c) =>
      (!term || [c.full_name, c.antenna ?? ""].some((v) => v.toLowerCase().includes(term))) &&
      (plan === "all" || String(c.plan_id) === plan) &&
      (estado === "all" || (!c.free && (estado === "paid") === c.paid)),
  );

  const receiptPaths = rows.flatMap((c) => (c.last?.receipt_path ? [c.last.receipt_path] : []));
  const { data: signed } = receiptPaths.length
    ? await db.storage.from("comprobantes").createSignedUrls(receiptPaths, 3600)
    : { data: [] };
  const receiptUrl = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const planItems = [{ value: "all", label: "Todos los servicios" }, ...(plans ?? []).map((p) => ({ value: String(p.id), label: p.name }))];
  const months = [...new Set(all.flatMap((c) => c.invoices.map((i) => i.period.slice(0, 7))))].sort().reverse();
  const mesItems = [
    { value: "all", label: "Todos los meses" },
    ...months.map((m) => ({
      value: m,
      label: new Date(`${m}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    })),
  ];
  const currentMonth = new Date().toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
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
          <AddClient key={ok ?? error ?? ""} plans={plans ?? []} />
          <form action={logout}><Button type="submit" variant="ghost" size="sm">Salir</Button></form>
        </div>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {ok && <p role="status" className="text-sm text-primary">{ok}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Clientes" value={clients.length} />
        <Stat title="Servicio pagado" value={billable.length - unpaid} />
        <Stat title="Servicio no pagado" value={unpaid} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre o antena" aria-label="Buscar cliente" className="sm:max-w-xs" />
        <FilterSelect name="plan" items={planItems} defaultValue={plan} />
        <FilterSelect name="mes" items={mesItems} defaultValue={mes} />
        <FilterSelect name="estado" items={estadoItems} defaultValue={estado} />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg first-letter:uppercase">
            Clientes · {mesItems.find((m) => m.value === mes && m.value !== "all")?.label ?? currentMonth}
          </CardTitle>
          <CardDescription>
            {mes === "all" ? "Se muestra la última factura de cada cliente." : "Se muestra la factura de este mes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Antena</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>{mes === "all" ? "Última factura" : "Factura del mes"}</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Comprobante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{c.antenna ?? "—"}</span>
                      {antennaUrl(c.antenna) ? (
                        <a
                          href={antennaUrl(c.antenna)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={antennaUrl(c.antenna)!}
                          className={buttonVariants({ variant: "outline", size: "xs" })}
                        >
                          Gestionar
                        </a>
                      ) : (
                        <Button variant="outline" size="xs" disabled title="Asigná una antena válida (ej.: 12, A12 o B3)">
                          Gestionar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{c.plans ? `${c.plans.name} · ${ars(c.plans.price)}` : "—"}</TableCell>
                  <TableCell>
                    {c.last ? (
                      <>
                        <div>{monto(c.last.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.last.period.slice(0, 7)} · {c.last.status === "paid" ? "pagada" : "pendiente"}
                        </div>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.free ? (
                      <Badge variant="outline">Sin cargo</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusBadge paid={c.paid} />
                        {c.last?.status === "pending" && <MarkPaid client={c} invoice={c.last} />}
                      </div>
                    )}
                    {c.payment_method && !c.free && (
                      <div className="mt-1 text-xs text-muted-foreground">{METHOD_LABEL[c.payment_method]}</div>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <EditPlan client={c} plans={plans ?? []} />
                    <DeleteClient client={c} />
                  </TableCell>
                  <TableCell>
                    {c.last?.receipt_path && receiptUrl.get(c.last.receipt_path) ? (
                      <ReceiptViewer client={c} invoice={c.last} url={receiptUrl.get(c.last.receipt_path)!} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={8} className="text-muted-foreground">Sin resultados.</TableCell></TableRow>
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

function ReceiptViewer({ client, invoice, url }: { client: Client; invoice: Invoice; url: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Ver PDF</DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comprobante · {client.full_name}</DialogTitle>
          <DialogDescription>
            {invoice.period.slice(0, 7)} · {monto(invoice.amount)}
          </DialogDescription>
        </DialogHeader>
        <iframe src={url} title={`Comprobante de ${client.full_name}`} className="h-[70vh] w-full rounded-lg bg-white" />
        <DialogFooter showCloseButton>
          <Button nativeButton={false} variant="secondary" render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
            Abrir en otra pestaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaid({ client, invoice }: { client: Client; invoice: Invoice }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" size="xs" />}>Marcar pagada</DialogTrigger>
      <DialogContent>
        <form action={markPaid} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Marcar como pagada</DialogTitle>
            <DialogDescription>
              {client.full_name} · {invoice.period.slice(0, 7)} · {monto(invoice.amount)}
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <div className="space-y-1.5">
            <Label htmlFor={`receipt-${invoice.id}`}>Comprobante en PDF (opcional, hasta 4 MB)</Label>
            <Input id={`receipt-${invoice.id}`} name="receipt" type="file" accept="application/pdf" />
          </div>
          <DialogFooter>
            <Button type="submit">Confirmar pago</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MethodSelect({ defaultValue }: { defaultValue?: Client["payment_method"] }) {
  const items = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));
  return (
    <div className="space-y-1.5">
      <Label>Medio de pago</Label>
      <Select name="payment_method" items={items} defaultValue={defaultValue ?? undefined}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Elegí cómo paga" /></SelectTrigger>
        <SelectContent>
          {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function AddClient({ plans }: { plans: Plan[] }) {
  const fields = [
    { name: "full_name", label: "Nombre completo" },
    { name: "antenna", label: "Número de antena (opcional)", required: false, placeholder: "Ej.: 12, A12 o B3" },
  ];
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>Agregar cliente</DialogTrigger>
      <DialogContent>
        <form action={addClient} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Agregar cliente</DialogTitle>
            <DialogDescription>Se crea el cliente con la factura del mes en curso.</DialogDescription>
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
          <MethodSelect />
          <DialogFooter>
            <Button type="submit">Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlan({ client, plans }: { client: Client; plans: Plan[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Editar</DialogTrigger>
      <DialogContent>
        <form action={updateClient} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{client.full_name}</DialogTitle>
            <DialogDescription>Si cambiás el plan, las facturas pendientes se actualizan al nuevo precio.</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Alta: {new Date(client.created_at).toLocaleDateString("es-AR", { dateStyle: "short" })}
          </p>
          <input type="hidden" name="user_id" value={client.id} />
          <div className="space-y-1.5">
            <Label htmlFor={`name-${client.id}`}>Nombre y apellido</Label>
            <Input id={`name-${client.id}`} name="full_name" defaultValue={client.full_name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`antenna-${client.id}`}>Número de antena</Label>
            <Input id={`antenna-${client.id}`} name="antenna" defaultValue={client.antenna ?? ""} placeholder="Ej.: 12, A12 o B3" />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <PlanSelect plans={plans} defaultValue={client.plan_id} />
          </div>
          <MethodSelect defaultValue={client.payment_method} />
          <DialogFooter>
            <DialogClose render={<Button type="submit" />}>Guardar</DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClient({ client }: { client: Client }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>Dar de baja</DialogTrigger>
      <DialogContent>
        <form action={deleteClient} className="space-y-4">
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {client.full_name}?</DialogTitle>
            <DialogDescription>Se elimina el cliente, sus facturas y sus comprobantes. No se puede deshacer.</DialogDescription>
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
