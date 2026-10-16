import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Fullvinet</CardTitle>
          <CardDescription>Panel de administración</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-3">
            {/* Lee la URL (error): va dentro de Suspense para que el resto sea estático */}
            <Suspense>
              <LoginError searchParams={searchParams} />
            </Suspense>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full">Ingresar</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;
}
