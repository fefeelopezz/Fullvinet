import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanSelect } from "@/components/plan-select";
import { getPlans } from "@/lib/supabase/server";
import { WhatsAppIcon } from "@/components/whatsapp-button";
import { whatsappUrl } from "@/lib/utils";
import { login, signup } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Fullvinet</CardTitle>
          <CardDescription>Accedé a tu cuenta de internet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense>
            <LoginForms searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

// Lee la URL (tab, error, msg): va dentro de Suspense para que el resto sea estático
async function LoginForms({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { tab, error, msg } = await searchParams;
  const plans = await getPlans();

  // Base UI no muestra un panel sin pestaña propia: la recuperación reemplaza a las pestañas
  if (tab === "reset") return (
    <div className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Para recuperar tu contraseña escribinos por WhatsApp y te ayudamos a restablecerla.
      </p>
      <Button
        nativeButton={false}
        className="w-full bg-[#25D366] text-white hover:bg-[#25D366]/90"
        render={<a href={whatsappUrl("Hola Fullvinet, necesito recuperar la contraseña de mi cuenta.")} target="_blank" rel="noopener noreferrer" />}
      >
        <WhatsAppIcon className="size-4" />
        Contactar por WhatsApp
      </Button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
        Volver a ingresar
      </Link>
    </div>
  );

  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {/* key: al navegar a otro ?tab= se vuelve a montar con esa pestaña */}
      <Tabs key={String(tab)} defaultValue={tab === "signup" ? "signup" : "login"}>
        <TabsList className="w-full">
          <TabsTrigger value="login">Ingresar</TabsTrigger>
          <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form action={login} className="space-y-3 pt-2">
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Contraseña" type="password" />
            <Button type="submit" className="w-full">Ingresar</Button>
            <Link href="/login?tab=reset" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form action={signup} className="space-y-3 pt-2">
            <Field name="full_name" label="Nombre completo" />
            <Field name="address" label="Dirección del servicio" autoComplete="street-address" />
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Contraseña" type="password" minLength={6} />
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <PlanSelect plans={plans ?? []} />
            </div>
            <Button type="submit" className="w-full">Crear cuenta</Button>
          </form>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ name, label, ...props }: { name: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required {...props} />
    </div>
  );
}
