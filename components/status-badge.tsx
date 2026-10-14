import { Badge } from "@/components/ui/badge";

export function StatusBadge({ paid }: { paid: boolean }) {
  return <Badge variant={paid ? "secondary" : "destructive"}>{paid ? "Pagado" : "No pagado"}</Badge>;
}
