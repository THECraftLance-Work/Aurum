"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Trash2, Edit3 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function ProjectPickerClient({ projects, isAdmin, isDirector }: { projects: any[]; isAdmin: boolean; isDirector?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [projectsList, setProjectsList] = useState<any[]>(projects);
  useEffect(() => {
    setProjectsList(projects);
  }, [projects]);
  const [current, setCurrent] = useState<string | null>(null);
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editSale, setEditSale] = useState("");
  const [editFields, setEditFields] = useState({ saleable_area: "", carpet_area: "", external_walls_area: "", balcony_utility_area: "", common_area: "", base_price: "", floor_rise_charges: "", east_facing_charges: "", premium_view_charges: "", amenities_charges: "", car_parking_charges: "", legal_documentation_charges: "", sale_consideration_per_sqft: "" });
  const [deleting, setDeleting] = useState<any | null>(null);
  const [delSlug, setDelSlug] = useState(""); const [delConfirm, setDelConfirm] = useState(""); const [delPw, setDelPw] = useState(""); const [delOtp, setDelOtp] = useState(""); const [otpSent, setOtpSent] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const refreshCurrent = () => {
    const c = document.cookie.match(/(?:^|; )srivaraha_project=([^;]*)/)?.[1];
    if (c) setCurrent(decodeURIComponent(c));
    else {
      const ls = localStorage.getItem("srivaraha_project");
      setCurrent(ls ? ls : null);
    }
  };
  useEffect(() => {
    refreshCurrent();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "srivaraha_project") refreshCurrent(); };
    const onCustom = () => refreshCurrent();
    window.addEventListener("storage", onStorage);
    window.addEventListener("srivaraha:project", onCustom as any);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("srivaraha:project", onCustom as any); };
  }, []);
  function select(id: string) {
    document.cookie = `srivaraha_project=${encodeURIComponent(id)}; path=/; max-age=315360000`;
    document.cookie = `srivaraha_onboarded=1; path=/; max-age=315360000`;
    localStorage.setItem("srivaraha_project", id);
    try { localStorage.setItem("srivaraha_onboarded", "1"); } catch {}
    setCurrent(id);
    window.dispatchEvent(new CustomEvent("srivaraha:project", { detail: id }));
    window.dispatchEvent(new StorageEvent("storage", { key: "srivaraha_project", newValue: id } as any));
    router.refresh();
    router.push("/dashboard");
  }
  async function create() {
    const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug, parent_slug: "sri-varaha" }) });
    const j = await res.json().catch(()=> ({}));
    if (!res.ok) { toast({ title: j.error ?? "Failed to create project", tone: "error" }); return; }
    toast({ title: "Project created", tone: "success" });
    setName(""); setSlug(""); router.refresh();
  }
  function startEdit(p: any) {
    setEditing(p);
    setEditSale(p.default_sale_consideration !== undefined && p.default_sale_consideration !== null ? String(p.default_sale_consideration) : "");
    const a = p.default_areas ?? {};
    setEditFields({
      saleable_area: a.saleable_area !== undefined && a.saleable_area !== null ? String(a.saleable_area) : "",
      carpet_area: a.carpet_area !== undefined && a.carpet_area !== null ? String(a.carpet_area) : "",
      external_walls_area: a.external_walls_area !== undefined && a.external_walls_area !== null ? String(a.external_walls_area) : "",
      balcony_utility_area: a.balcony_utility_area !== undefined && a.balcony_utility_area !== null ? String(a.balcony_utility_area) : "",
      common_area: a.common_area !== undefined && a.common_area !== null ? String(a.common_area) : "",
      base_price: a.base_price !== undefined && a.base_price !== null ? String(a.base_price) : "",
      floor_rise_charges: a.floor_rise_charges !== undefined && a.floor_rise_charges !== null ? String(a.floor_rise_charges) : "",
      east_facing_charges: a.east_facing_charges !== undefined && a.east_facing_charges !== null ? String(a.east_facing_charges) : "",
      premium_view_charges: a.premium_view_charges !== undefined && a.premium_view_charges !== null ? String(a.premium_view_charges) : "",
      amenities_charges: a.amenities_charges !== undefined && a.amenities_charges !== null ? String(a.amenities_charges) : "",
      car_parking_charges: a.car_parking_charges !== undefined && a.car_parking_charges !== null ? String(a.car_parking_charges) : "",
      legal_documentation_charges: a.legal_documentation_charges !== undefined && a.legal_documentation_charges !== null ? String(a.legal_documentation_charges) : "",
      sale_consideration_per_sqft: a.sale_consideration_per_sqft !== undefined && a.sale_consideration_per_sqft !== null ? String(a.sale_consideration_per_sqft) : "",
    });
  }
  async function saveEdit() {
    if (!editing) return;
    const areas: any = {};
    Object.entries(editFields).forEach(([k,v]) => { if (String(v).trim() !== "") areas[k] = Number(v); });
    const saleVal = editSale ? Number(editSale) : null;
    const res = await fetch(`/api/projects/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ default_sale_consideration: saleVal, default_areas: areas }) });
    const j = await res.json().catch(()=> ({}));
    if (!res.ok) { toast({ title: j.error ?? "Failed to save", tone: "error" }); return; }
    toast({ title: "Defaults updated", tone: "success" });
    setProjectsList(prev => prev.map(p => p.id === editing.id ? { ...p, default_sale_consideration: saleVal, default_areas: areas } : p));
    setEditing(null);
    router.refresh();
  }
  async function sendDeleteOtp() {
    if (!deleting || otpSending) return;
    setOtpSending(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}/delete-otp`, { method: "POST" });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok) { toast({ title: j.error ?? "Failed to send code", tone: "error" }); return; }
      setOtpSent(true);
      toast({ title: "Code sent", description: `Check inbox for ${deleting.name} — valid 10 min`, tone: "success" });
    } finally {
      setOtpSending(false);
    }
  }
  async function doDelete() {
    if (!deleting || deletingBusy) return;
    // slug check is case-insensitive — user typing VAARHA vs vaarha should not mismatch
    if (delSlug.trim().toLowerCase() !== deleting.slug.toLowerCase()) { toast({ title: "Slug mismatch", description: `Type "${deleting.slug}" exactly (case-insensitive)`, tone: "error" }); return; }
    if (delConfirm.trim() !== "DELETE") { toast({ title: "Type DELETE to confirm", tone: "error" }); return; }
    // Director Google uses OTP, EMAIL uses password — send whichever is filled
    const payload: any = { slug: deleting.slug, confirmText: delConfirm };
    if (delOtp) payload.otp = delOtp;
    if (delPw) payload.password = delPw;
    if (!payload.otp && !payload.password) { toast({ title: "Enter code from email or password", tone: "error" }); return; }
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok) { toast({ title: j.error ?? "Failed to delete project", tone: "error" }); return; }
      toast({ title: "Project deleted", description: "All data emailed to you. Accounts remain.", tone: "success" });
      const wasCurrent = current === deleting.id;
      setDeleting(null); setDelSlug(""); setDelConfirm(""); setDelPw(""); setDelOtp(""); setOtpSent(false);
      // if deleted project was selected, clear selection and update header fast
      if (wasCurrent) {
        document.cookie = `srivaraha_project=; path=/; max-age=0`;
        try { localStorage.removeItem("srivaraha_project"); } catch {}
        setCurrent(null);
        window.dispatchEvent(new CustomEvent("srivaraha:project", { detail: "" }));
        window.dispatchEvent(new StorageEvent("storage", { key: "srivaraha_project", newValue: "" } as any));
      }
      router.refresh();
    } finally {
      setDeletingBusy(false);
    }
  }
  const company = projectsList.find((p: any) => p.slug === "sri-varaha");
  const items = projectsList.filter((p: any) => p.slug !== "sri-varaha");
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className={`card p-5 border-2 flex flex-col ${current===p.id ? "border-[#ec3013] bg-red-50/40" : "border-slate-200"}`}>
            <button onClick={() => select(p.id)} className="text-left flex-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-slate-500">{p.slug} {company ? `• ${company.name}` : ""}</div>
              {current===p.id && <div className="mt-2 text-xs font-medium text-[#ec3013]">● Selected</div>}
              <div className="mt-2 text-xs text-slate-400">Sale: {p.default_sale_consideration ?? "—"} • Areas: {p.default_areas ? Object.keys(p.default_areas).length : 0} defaults</div>
            </button>
            <div className="mt-3 flex gap-2">
              {isAdmin && <button onClick={() => startEdit(p)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50"><Edit3 className="h-3 w-3" /> Edit defaults</button>}
              {isDirector && <button onClick={() => { setDeleting(p); setDelSlug(""); setDelConfirm(""); setDelPw(""); setDelOtp(""); setOtpSent(false); }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-100"><Trash2 className="h-3 w-3" /> Delete</button>}
            </div>
          </div>
        ))}
        {items.length===0 && <div className="col-span-3 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No projects yet — Admin can create new projects under {company?.name ?? "Sri Varaha"}</div>}
      </div>
      {isAdmin && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Add project (Admin only)</h3>
           <div className="grid gap-3 sm:grid-cols-3">
             <input className="input" placeholder="Name e.g. Green Valley" value={name} onChange={e=> setName(e.target.value)} />
             <input className="input" placeholder="slug e.g. green-valley" value={slug} onChange={e=> setSlug(e.target.value)} />
             <button onClick={create} className="btn-primary">Create under Sri Varaha</button>
           </div>
        </div>
      )}

      {mounted && editing && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <button className="absolute inset-0" onClick={()=> setEditing(null)} aria-label="Close" />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l animate-rm-in">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="font-semibold">Edit defaults — {editing.name}</h3>
                <p className="text-xs text-slate-500">Sale consideration & areas for this project</p>
              </div>
              <button onClick={()=> setEditing(null)} className="rounded-lg p-2 hover:bg-slate-100">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="label">Default sale consideration (₹)</label>
                <input className="input" type="number" value={editSale} onChange={e=> setEditSale(e.target.value)} placeholder="e.g. 5000000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["saleable_area","Saleable area"],
                  ["carpet_area","Carpet area"],
                  ["external_walls_area","External walls area"],
                  ["balcony_utility_area","Balcony & utility area"],
                  ["common_area","Common area"],
                  ["base_price","Base price (₹)"],
                  ["floor_rise_charges","Floor rise charges (₹)"],
                  ["east_facing_charges","East facing charges (₹)"],
                  ["premium_view_charges","Premium view charges (₹)"],
                  ["amenities_charges","Amenities charges (₹)"],
                  ["car_parking_charges","Car parking charges (₹)"],
                  ["legal_documentation_charges","Legal documentation (₹)"],
                  ["sale_consideration_per_sqft","Sale consideration / sqft (₹)"],
                ].map(([key,label])=> (
                  <label key={key} className="block">
                    <span className="label">{label}</span>
                    <input className="input" type="number" value={(editFields as any)[key] ?? ""} onChange={e=> setEditFields(f=> ({...f, [key]: e.target.value}))} placeholder="—" />
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">These defaults prefill New Booking → Sale consideration & areas when this project is selected — just like the New Booking form fields.</p>
            </div>
            <div className="flex justify-end gap-2 border-t p-4 bg-slate-50">
              <button onClick={()=> setEditing(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} className="btn-primary">Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && deleting && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <button className="absolute inset-0" onClick={()=> { setDeleting(null); setOtpSent(false); }} aria-label="Close delete modal" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border animate-rm-in">
            <h3 className="font-semibold text-rose-700">Delete {deleting.name}?</h3>
            <p className="text-sm text-slate-600 mt-1">Director verification: type slug, type DELETE, then send a 6-digit code to your email. Accounts remain — only project data is removed and emailed to you for audit.</p>
            <label className="text-xs font-medium text-slate-700 mt-3 block normal-case tracking-normal">Type slug <span className="font-mono bg-slate-100 px-1 rounded normal-case">{deleting.slug}</span> to confirm</label>
            <input className="input mt-1" value={delSlug} onChange={e=> setDelSlug(e.target.value)} placeholder={deleting.slug} autoComplete="off" />
            <label className="text-xs font-medium text-slate-700 mt-3 block normal-case tracking-normal">Type DELETE</label>
            <input className="input mt-1" value={delConfirm} onChange={e=> setDelConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
            <div className="mt-4 flex items-center gap-2">
              <button onClick={sendDeleteOtp} disabled={otpSending} type="button" className="btn-secondary border-[#ec3013]/20 bg-red-50 text-[#ec3013] hover:bg-red-100 hover:border-[#ec3013]/30 text-xs font-semibold disabled:opacity-50">
                {otpSending ? "Sending…" : otpSent ? "Resend code" : "Send code to email"}
              </button>
              {otpSent && <span className="text-xs font-medium text-emerald-600">✓ Code sent (valid 10 min)</span>}
            </div>
            <label className="text-xs font-medium text-slate-700 mt-4 block normal-case tracking-normal">Code from email (Google Director) or password (Email Director)</label>
            <input className="input" value={delOtp} onChange={e=> setDelOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} />
            <input className="input mt-2" type="password" value={delPw} onChange={e=> setDelPw(e.target.value)} placeholder="Or password if Email account" />
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=> { setDeleting(null); setOtpSent(false); }} disabled={deletingBusy} className="btn-secondary disabled:opacity-50">Cancel</button>
              <button onClick={doDelete} disabled={deletingBusy} className="btn-danger disabled:opacity-50 min-w-[148px]">
                {deletingBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
