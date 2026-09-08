"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectSwitcher() {
  const [projects, setProjects] = useState<any[]>([]);
  const [current, setCurrent] = useState<string>("");
  useEffect(() => {
    fetch("/api/projects").then(r=>r.json()).then(j=> setProjects(j.projects ?? [])).catch(()=>{});
    const c = document.cookie.match(/(?:^|; )srivaraha_project=([^;]*)/)?.[1];
    setCurrent(c ? decodeURIComponent(c) : localStorage.getItem("srivaraha_project") ?? "");
  }, []);
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    document.cookie = `srivaraha_project=${encodeURIComponent(id)}; path=/; max-age=31536000`;
    localStorage.setItem("srivaraha_project", id);
    setCurrent(id);
    location.reload();
  }
  if (!projects.length) return null;
  return (
    <select value={current} onChange={onChange} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium">
      <option value="">SRIVARAHA / Projects</option>
      {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
