# Fullvinet · Panel de administración

Dashboard interno de **Fullvinet**, proveedor de internet inalámbrico. Reemplaza la planilla de Excel con la que se llevaban los clientes y los pagos: en un solo lugar se ve quién pagó el mes, cuánto se cobró, qué plan tiene cada cliente y cómo entrar a su antena o a los equipos de cada zona.

Los clientes no tienen usuario: pagan por WhatsApp (transferencia o efectivo) y el administrador registra el pago en el panel, adjuntando el comprobante.

## Qué hace

- **Clientes**: alta, edición (nombre, antena, plan, zona, medio de pago) y baja. Buscador, filtros por plan, estado y mes, y orden por número de antena.
- **Facturación mensual**: el 1° de cada mes se generan solas las facturas del mes para todos los clientes con cargo.
- **Pagos**: marcar una factura como pagada subiendo el comprobante en PDF o foto (JPG, PNG, WEBP), verlo dentro de la página y deshacer el pago si hubo un error.
- **Clientes sin cargo**: se pasan a "sin cargo" o "con cargo" con un clic; los sin cargo no generan facturas ni cuentan en los totales.
- **Resumen del mes**: cantidad de clientes, servicios pagados y no pagados, y el total en pesos cobrado y pendiente del mes en curso.
- **Planes**: editor de precios para cuando hay aumentos.
- **Antenas**: botón "Gestionar" que abre la antena del cliente según su número (`192.168.20.N`, `A` → `192.168.21.N`, `B` → `192.168.24.N`).
- **Zonas**: elegí una zona del menú (con buscador) y aparecen sus IPs de enlace y de paneles, para editar, quitar, agregar o abrir el equipo. También se pueden crear zonas nuevas.
- **Detalle del cliente**: al tocar el nombre se ve su zona, plan, monto mensual y el historial de pagos.

## Tecnologías

| | |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions, Cache Components) |
| UI | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) sobre [Base UI](https://base-ui.com), íconos [Lucide](https://lucide.dev) |
| Base de datos y auth | [Supabase](https://supabase.com): Postgres con Row Level Security, Auth y Storage privado para los comprobantes |
| Tareas programadas | `pg_cron` en Supabase para generar las facturas de cada mes |
| Lenguaje | TypeScript |
| Hosting | [Vercel](https://vercel.com) |

## Seguridad

- Solo existe **una cuenta de administrador**; el registro de usuarios está bloqueado en la base de datos.
- Todas las acciones del servidor verifican que quien las ejecuta sea el administrador.
- Los comprobantes se guardan en un bucket privado y se muestran con URLs firmadas que vencen en una hora. Se valida el tipo real del archivo (no solo la extensión) y el tamaño máximo de 4 MB.

## Correrlo en local

Requisitos: Node.js 20+ y un proyecto de Supabase.

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` con las claves del proyecto de Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=
   ```

3. Aplicar las migraciones de `supabase/migrations/` en orden (con la CLI de Supabase o desde el SQL Editor).

4. Levantar el servidor de desarrollo y entrar a [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Estructura

```
app/
  admin/        panel (page.tsx) y acciones del servidor (actions.ts)
  login/        inicio de sesión del administrador
components/     componentes propios y componentes de shadcn/ui (ui/)
lib/supabase/   clientes de Supabase y control de acceso
supabase/       migraciones SQL (tablas, políticas, cron, storage)
proxy.ts        refresco de la sesión en cada request
```
