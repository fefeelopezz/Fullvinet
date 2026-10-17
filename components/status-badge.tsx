import { Badge } from "@/components/ui/badge";

export function StatusBadge({ paid }: { paid: boolean }) {
  return <Badge variant={paid ? "secondary" : "destructive"} className={paid ? "bg-emerald-600 text-white" : undefined}>{paid ? "Pagado" : "No pagado"}</Badge>;
}
