"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ZonePicker({ items, panels }: { items: { value: string; label: string }[]; panels: Record<string, ReactNode> }) {
  const [zone, setZone] = useState(items[0]?.value ?? "");
  const [query, setQuery] = useState("");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const match = (q: string) => items.filter((i) => norm(i.label).includes(norm(q)));
  const shown = match(query);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="zone-search">Elegí una zona</Label>
        <div className="flex gap-2">
          <Input
            id="zone-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              const first = match(e.target.value)[0];
              if (first) setZone(first.value);
            }}
            placeholder="Buscar zona…"
            className="sm:max-w-56"
          />
          <Select items={items} value={zone} onValueChange={(v) => setZone(String(v ?? ""))}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Elegí la zona" /></SelectTrigger>
            <SelectContent>
              {shown.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!shown.length && <p className="text-sm text-muted-foreground">No hay zonas con ese nombre.</p>}
      </div>
      {panels[zone]}
    </div>
  );
}
