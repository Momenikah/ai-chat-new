"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/n8n/code-block";
import { N8N_RECIPES } from "@/components/n8n/recipes";

export function RecipeGallery() {
  const [activeKey, setActiveKey] = useState(N8N_RECIPES[0].key);
  const active = N8N_RECIPES.find((r) => r.key === activeKey) ?? N8N_RECIPES[0];

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="font-semibold">Recipe siap import</h2>
        <p className="text-sm text-muted-foreground">
          Pilih template, salin atau download JSON-nya, lalu Import from
          Clipboard / File di n8n.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {N8N_RECIPES.map((r) => {
          const on = r.key === activeKey;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveKey(r.key)}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                on
                  ? "border-zinc-900 ring-1 ring-zinc-900"
                  : "border-border hover:border-zinc-300",
              )}
            >
              <span className="text-lg">{r.emoji}</span>
              <span className="text-sm font-medium">{r.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {r.description}
              </span>
              <Badge variant="outline" className="mt-1 w-fit font-mono text-[10px]">
                {r.event}
              </Badge>
            </button>
          );
        })}
      </div>

      <CodeBlock code={active.workflow} downloadName={active.filename} />
    </Card>
  );
}
