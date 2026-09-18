"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlanControls({
  planId,
  actions
}: {
  planId: string;
  actions: Array<{ label: string; action: string; variant: "primary" | "secondary" | "danger" }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<any>(null);

  async function run(action: string) {
    setLoading(action);
    const res = await fetch("/api/orchestrate/plan", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, action })
    });
    setLoading(null);
    if (action === "deploy") {
      const data = await res.json();
      setDeployResult(data);
    }
    router.refresh();
  }

  if (actions.length === 0 && !deployResult) {
    return null;
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-700 mr-2">Workflow control:</span>
        {actions.map((a) => (
          <button
            key={a.action}
            disabled={loading !== null}
            onClick={() => run(a.action)}
            className={`btn btn-sm ${
              a.variant === "primary" ? "btn-primary"
                : a.variant === "danger" ? "btn-danger"
                  : "btn-secondary"
            }`}
          >
            {loading === a.action ? "Working..." : a.label}
          </button>
        ))}
      </div>
      {deployResult && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm">
          <strong>Deployment complete:</strong> {deployResult.deployed} campaigns created.
          {deployResult.errors?.length > 0 && (
            <div className="text-rose-600 mt-1">Errors: {deployResult.errors.join("; ")}</div>
          )}
        </div>
      )}
    </div>
  );
}