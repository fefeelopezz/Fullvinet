import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ars } from "@/lib/utils";

export type Plan = { id: number; name: string; speed_mbps: number; price: number };

export function PlanSelect({ plans, defaultValue }: { plans: Plan[]; defaultValue?: number | null }) {
  const items = plans.map((p) => ({
    value: String(p.id),
    label: `${p.name} · ${p.speed_mbps} Mbps · ${ars(p.price)}`,
  }));
  return (
    <Select name="plan_id" required items={items} defaultValue={defaultValue ? String(defaultValue) : undefined}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Elegí un plan" />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
