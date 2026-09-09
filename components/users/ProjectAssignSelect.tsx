"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Building2, Check } from "lucide-react";

type Props = {
  userId: string;
  initialProjectId?: string | null;
  compact?: boolean;
};

export default function ProjectAssignSelect({ userId, initialProjectId = null, compact = false }: Props) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [value, setValue] = useState<string>(initialProjectId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialProjectId ?? "");
  }, [initialProjectId]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(j => {
      const list = (j.projects ?? []).filter((p: any) => p.slug !== "sri-varaha" && p.is_active);
      setProjects(list);
    }).catch(() => {});
  }, []);

  async function onChange(next: string) {
    const project_id = next === "" ? null : next;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/project`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: j.error ?? "Failed to assign project", tone: "error" });
        setValue(initialProjectId ?? "");
        return;
      }
      const projName = next ? projects.find(p => p.id === next)?.name ?? "project" : "No project";
      toast({ title: next ? `Assigned to ${projName}` : "Unassigned", description: next ? "User will auto-enter this project after login" : "User will see project picker", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Failed", tone: "error" });
      setValue(initialProjectId ?? "");
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
        onClick={e => e.stopPropagation()}
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-w-[140px]"
        title="Assign project"
      >
        <option value="">— No assignment —</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name} · {p.slug}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shrink-0">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-slate-700">Assigned project</div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <option value="">— Not assigned (user picks) —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} · {p.slug}</option>
          ))}
        </select>
        <div className="mt-1 text-[11px] text-slate-500">
          {value ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" /> Auto-redirects on next login</span> : "User will see Sree Varaaha picker after login"}
        </div>
      </div>
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
    </div>
  );
}
