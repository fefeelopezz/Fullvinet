import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanSelect } from "@/components/plan-select";
import { getPlans } from "@/lib/supabase/server";
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

  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <Tabs defaultValue={tab === "signup" ? "signup" : "login"}>
        <TabsList className="w-full">
          <TabsTrigger value="login">Ingresar</TabsTrigger>
          <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form action={login} className="space-y-3 pt-2">
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Contraseña" type="password" />
            <Button type="submit" className="w-full">Ingresar</Button>
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
