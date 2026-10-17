"use client";

import { useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ZonePicker({ items, panels }: { items: { value: string; label: string }[]; panels: Record<string, ReactNode> }) {
  const [zone, setZone] = useState(items[0]?.value ?? "");
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Elegí una zona</Label>
        <Select items={items} value={zone} onValueChange={(v) => setZone(String(v ?? ""))}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Elegí la zona" /></SelectTrigger>
          <SelectContent>
            {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {panels[zone]}
    </div>
  );
}
