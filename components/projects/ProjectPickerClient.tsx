"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Trash2,
  Edit3,
  Upload,
  Building2,
  ArrowRight,
  Search,
  SearchX,
  Grid2X2,
  List,
  Lightbulb,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import RaiseTicketModal from "@/components/tickets/RaiseTicketModal";

export default function ProjectPickerClient({
  projects,
  isAdmin,
  isDirector,
}: {
  projects: any[];
  isAdmin: boolean;
  isDirector?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [projectsList, setProjectsList] = useState<any[]>(projects);
  useEffect(() => {
    setProjectsList(projects);
  }, [projects]);
  const [current, setCurrent] = useState<string | null>(null);
  const [confirmProject, setConfirmProject] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [contactOpen, setContactOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editSale, setEditSale] = useState("");
  const [editFields, setEditFields] = useState({
    saleable_area: "",
    carpet_area: "",
    external_walls_area: "",
    balcony_utility_area: "",
    common_area: "",
    base_price: "",
    floor_rise_charges: "",
    east_facing_charges: "",
    premium_view_charges: "",
    amenities_charges: "",
    car_parking_charges: "",
    legal_documentation_charges: "",
    sale_consideration_per_sqft: "",
  });
  const [deleting, setDeleting] = useState<any | null>(null);
  const [delSlug, setDelSlug] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delPw, setDelPw] = useState("");
  const [delOtp, setDelOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "srivaraha_project") refreshCurrent();
    };
    const onCustom = () => refreshCurrent();
    window.addEventListener("storage", onStorage);
    window.addEventListener("srivaraha:project", onCustom as any);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("srivaraha:project", onCustom as any);
    };
  }, []);
  function select(id: string) {
    const project = projectsList.find((item: any) => item.id === id);
    if (!project || id === current) return;
    setConfirmProject(project);
  }
  function confirmSelect() {
    const id = confirmProject?.id as string | undefined;
    if (!id) return;
    setConfirmProject(null);
    document.cookie = `srivaraha_project=${encodeURIComponent(id)}; path=/; max-age=315360000`;
    document.cookie = `srivaraha_onboarded=1; path=/; max-age=315360000`;
    localStorage.setItem("srivaraha_project", id);
    try {
      localStorage.setItem("srivaraha_onboarded", "1");
    } catch {}
    setCurrent(id);
    window.dispatchEvent(new CustomEvent("srivaraha:project", { detail: id }));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "srivaraha_project",
        newValue: id,
      } as any),
    );
    router.refresh();
    router.push("/dashboard");
  }
  async function create() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug, parent_slug: "sri-varaha", logo }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: j.error ?? "Failed to create project", tone: "error" });
      return;
    }
    toast({ title: "Project created", tone: "success" });
    setName("");
    setSlug("");
    setLogo(null);
    router.refresh();
  }
  function startEdit(p: any) {
    setEditing(p);
    setEditSale(
      p.default_sale_consideration !== undefined &&
        p.default_sale_consideration !== null
        ? String(p.default_sale_consideration)
        : "",
    );
    const a = p.default_areas ?? {};
    setEditFields({
      saleable_area:
        a.saleable_area !== undefined && a.saleable_area !== null
          ? String(a.saleable_area)
          : "",
      carpet_area:
        a.carpet_area !== undefined && a.carpet_area !== null
          ? String(a.carpet_area)
          : "",
      external_walls_area:
        a.external_walls_area !== undefined && a.external_walls_area !== null
          ? String(a.external_walls_area)
          : "",
      balcony_utility_area:
        a.balcony_utility_area !== undefined && a.balcony_utility_area !== null
          ? String(a.balcony_utility_area)
          : "",
      common_area:
        a.common_area !== undefined && a.common_area !== null
          ? String(a.common_area)
          : "",
      base_price:
        a.base_price !== undefined && a.base_price !== null
          ? String(a.base_price)
          : "",
      floor_rise_charges:
        a.floor_rise_charges !== undefined && a.floor_rise_charges !== null
          ? String(a.floor_rise_charges)
          : "",
      east_facing_charges:
        a.east_facing_charges !== undefined && a.east_facing_charges !== null
          ? String(a.east_facing_charges)
          : "",
      premium_view_charges:
        a.premium_view_charges !== undefined && a.premium_view_charges !== null
          ? String(a.premium_view_charges)
          : "",
      amenities_charges:
        a.amenities_charges !== undefined && a.amenities_charges !== null
          ? String(a.amenities_charges)
          : "",
      car_parking_charges:
        a.car_parking_charges !== undefined && a.car_parking_charges !== null
          ? String(a.car_parking_charges)
          : "",
      legal_documentation_charges:
        a.legal_documentation_charges !== undefined &&
        a.legal_documentation_charges !== null
          ? String(a.legal_documentation_charges)
          : "",
      sale_consideration_per_sqft:
        a.sale_consideration_per_sqft !== undefined &&
        a.sale_consideration_per_sqft !== null
          ? String(a.sale_consideration_per_sqft)
          : "",
    });
  }
  async function saveEdit() {
    if (!editing) return;
    const areas: any = {};
    Object.entries(editFields).forEach(([k, v]) => {
      if (String(v).trim() !== "") areas[k] = Number(v);
    });
    const saleVal = editSale ? Number(editSale) : null;
    const res = await fetch(`/api/projects/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        default_sale_consideration: saleVal,
        default_areas: areas,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: j.error ?? "Failed to save", tone: "error" });
      return;
    }
    toast({ title: "Defaults updated", tone: "success" });
    setProjectsList((prev) =>
      prev.map((p) =>
        p.id === editing.id
          ? { ...p, default_sale_consideration: saleVal, default_areas: areas }
          : p,
      ),
    );
    setEditing(null);
    router.refresh();
  }
  async function sendDeleteOtp() {
    if (!deleting || otpSending) return;
    setOtpSending(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}/delete-otp`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: j.error ?? "Failed to send code", tone: "error" });
        return;
      }
      setOtpSent(true);
      toast({
        title: "Code sent",
        description: `Check inbox for ${deleting.name} — valid 10 min`,
        tone: "success",
      });
    } finally {
      setOtpSending(false);
    }
  }
  async function doDelete() {
    if (!deleting || deletingBusy) return;
    // slug check is case-insensitive — user typing VAARHA vs vaarha should not mismatch
    if (delSlug.trim().toLowerCase() !== deleting.slug.toLowerCase()) {
      toast({
        title: "Slug mismatch",
        description: `Type "${deleting.slug}" exactly (case-insensitive)`,
        tone: "error",
      });
      return;
    }
    if (delConfirm.trim() !== "DELETE") {
      toast({ title: "Type DELETE to confirm", tone: "error" });
      return;
    }
    // Director Google uses OTP, EMAIL uses password — send whichever is filled
    const payload: any = { slug: deleting.slug, confirmText: delConfirm };
    if (delOtp) payload.otp = delOtp;
    if (delPw) payload.password = delPw;
    if (!payload.otp && !payload.password) {
      toast({ title: "Enter code from email or password", tone: "error" });
      return;
    }
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: j.error ?? "Failed to delete project", tone: "error" });
        return;
      }
      toast({
        title: "Project deleted",
        description: "All data emailed to you. Accounts remain.",
        tone: "success",
      });
      const wasCurrent = current === deleting.id;
      setDeleting(null);
      setDelSlug("");
      setDelConfirm("");
      setDelPw("");
      setDelOtp("");
      setOtpSent(false);
      // if deleted project was selected, clear selection and update header fast
      if (wasCurrent) {
        document.cookie = `srivaraha_project=; path=/; max-age=0`;
        try {
          localStorage.removeItem("srivaraha_project");
        } catch {}
        setCurrent(null);
        window.dispatchEvent(
          new CustomEvent("srivaraha:project", { detail: "" }),
        );
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "srivaraha_project",
            newValue: "",
          } as any),
        );
      }
      router.refresh();
    } finally {
      setDeletingBusy(false);
    }
  }
  const company = projectsList.find((p: any) => p.slug === "sri-varaha");
  const items = projectsList.filter((p: any) => p.slug !== "sri-varaha");
  const filteredItems = items.filter((p: any) =>
    `${p.name} ${p.slug}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-7 bg-[#F8FAFC] text-[#172033]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#172033]">
            Your Projects
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Select a project to continue to its dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center rounded-[10px] border border-[#E2E8F0] bg-white p-1 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${view === "grid" ? "bg-[#F0EEFF] text-[#6366F1]" : "text-[#94A3B8] hover:text-[#64748B]"}`}
              aria-label="Grid view"
            >
              <Grid2X2 className="h-3.5 w-3.5" /> Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${view === "list" ? "bg-[#F0EEFF] text-[#6366F1]" : "text-[#94A3B8] hover:text-[#64748B]"}`}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <label className="relative block w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              className="input h-10 rounded-[10px] border-[#E2E8F0] pl-9 text-[#172033] shadow-[0_2px_8px_rgba(15,23,42,0.04)] placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:ring-[#6366F1]/15"
              placeholder="Search projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div
          className={
            view === "grid"
              ? "grid items-stretch gap-4 sm:grid-cols-2"
              : "space-y-3"
          }
        >
          {filteredItems.map((p, i) => (
            <div
              key={p.id}
              className={`group flex min-w-0 flex-col rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] ${current === p.id ? "border-[#6366F1] ring-2 ring-[#6366F1]/10" : "border-[#E2E8F0]"}`}
            >
              <button
                onClick={() => select(p.id)}
                className="flex w-full flex-1 cursor-pointer items-center gap-3 text-left sm:gap-4"
              >
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-[#E2E8F0] sm:h-[76px] sm:w-[76px]"
                  />
                ) : (
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white sm:h-[76px] sm:w-[76px]">
                    <Building2 className="h-7 w-7" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[17px] font-semibold text-[#172033]">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#10B981]">
                      Active
                    </span>
                  </span>
                  <span className="mt-2 block text-xs text-[#64748B]">
                    Isolated bookings &amp; payments
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                    <span>
                      <b className="font-semibold text-[#172033]">{p.default_sale_consideration ?? "—"}</b> Sale
                    </span>
                    <span>
                      <b>
                        {p.default_areas
                          ? Object.keys(p.default_areas).length
                          : 0}
                      </b>{" "}
                      Areas
                    </span>
                  </span>
                </span>
                <span                 className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F0EEFF] text-[#6366F1] transition-all duration-200 group-hover:scale-[1.03] group-hover:bg-[#6366F1] group-hover:text-white">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
              {(isAdmin || isDirector) && (
                <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
                  {isAdmin && (
                    <button
                      onClick={() => startEdit(p)}
                      className="btn-secondary h-8 flex-1 text-xs"
                    >
                      <Edit3 className="h-3 w-3" /> Edit defaults
                    </button>
                  )}
                  {isDirector && (
                    <button
                      onClick={() => {
                        setDeleting(p);
                        setDelSlug("");
                        setDelConfirm("");
                        setDelPw("");
                        setDelOtp("");
                        setOtpSent(false);
                      }}
                      className="h-8 rounded-lg border border-rose-200 px-3 text-xs text-rose-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {!filteredItems.length && (
            <div className="col-span-full flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
              <div className="relative mb-5">
                <div className="absolute -inset-3 rounded-full bg-[#EEF2FF] opacity-70" />
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-[#E0E7FF] bg-gradient-to-br from-[#F5F3FF] to-[#EEF2FF] text-[#6366F1]">
                  <SearchX className="h-8 w-8" strokeWidth={1.6} />
                </div>
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#C4B5FD] ring-4 ring-white" />
                <span className="absolute -bottom-1 -left-2 h-2 w-2 rounded-full bg-[#A5B4FC] ring-2 ring-white" />
              </div>
              <h3 className="text-sm font-semibold text-[#172033]">
                {query.trim() ? "No projects found" : "No projects available"}
              </h3>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-[#64748B]">
                {query.trim()
                  ? "Try a different project name or clear your search."
                  : "Projects assigned to your account will appear here."}
              </p>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl border border-[#E9E7F5] bg-[#FAF9FF] p-4">
            <div className="flex items-center gap-2 text-base font-semibold text-[#172033]">
              <Lightbulb className="h-5 w-5 text-[#6366F1]" /> Quick Tips
            </div>
            <ul className="mt-3 space-y-2.5 text-sm text-[#64748B]">
              {[
                "Each project has separate data",
                "Your access is based on your role",
                "Switch projects anytime",
                "Contact admin for access issues",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6366F1]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#C026D3] p-4 text-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
            <h3 className="text-lg font-bold">Need Help?</h3>
            <p className="mt-1 text-sm text-white/85">
              Facing issues or need access to a project?
            </p>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-[#172033] shadow-sm transition hover:bg-[#FAF9FF]"
            >
              Contact Admin <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </div>
      {mounted &&
        contactOpen &&
        createPortal(
          <RaiseTicketModal
            open={contactOpen}
            onClose={() => setContactOpen(false)}
          />,
          document.body,
        )}
      {isAdmin && (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h3 className="text-sm font-semibold">Add project</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create a workspace with its own identity and secure data.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
            <input
              className="input"
              placeholder="Name e.g. Green Valley"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="slug e.g. green-valley"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:border-[#ec3013] hover:bg-red-50">
              {logo ? (
                <img
                  src={logo}
                  alt="Logo preview"
                  className="h-7 w-7 rounded object-contain"
                />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{logo ? "Logo selected" : "Upload logo"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    toast({
                      title: "Logo must be 2 MB or smaller",
                      tone: "error",
                    });
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setLogo(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <button onClick={create} className="btn-primary">
              Create project <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {mounted &&
        confirmProject &&
        createPortal(
          <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h2 className="text-base font-semibold text-slate-900">
                Switch project?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to switch to{" "}
                <strong>{confirmProject.name}</strong>? The dashboard, bookings,
                and payments will update to this project.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmProject(null)}
                  className="btn-secondary h-10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSelect}
                  className="btn-primary h-10"
                >
                  Yes, switch
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mounted &&
        editing &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <button
              className="absolute inset-0"
              onClick={() => setEditing(null)}
              aria-label="Close"
            />
            <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l animate-rm-in">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h3 className="font-semibold">
                    Edit defaults — {editing.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sale consideration & areas for this project
                  </p>
                </div>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-2 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="label">
                    Default sale consideration / sqft (₹)
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={editSale}
                    onChange={(e) => setEditSale(e.target.value)}
                    placeholder="e.g. 5000000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["saleable_area", "Saleable area"],
                    ["carpet_area", "Carpet area"],
                    ["external_walls_area", "External walls area"],
                    ["balcony_utility_area", "Balcony & utility area"],
                    ["common_area", "Common area"],
                    ["base_price", "Base price (₹)"],
                    ["floor_rise_charges", "Floor rise charges (₹)"],
                    ["east_facing_charges", "East facing charges (₹)"],
                    ["premium_view_charges", "Premium view charges (₹)"],
                    ["amenities_charges", "Amenities charges (₹)"],
                    ["car_parking_charges", "Car parking charges (₹)"],
                    ["legal_documentation_charges", "Legal documentation (₹)"],
                    [
                      "sale_consideration_per_sqft",
                      "Sale consideration / sqft (₹)",
                    ],
                  ].map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="label">{label}</span>
                      <input
                        className="input"
                        type="number"
                        value={(editFields as any)[key] ?? ""}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder="—"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  These defaults prefill New Booking → Sale consideration / sqft
                  and area fields. Total property value must be entered
                  separately for each booking.
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t p-4 bg-slate-50">
                <button
                  onClick={() => setEditing(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={saveEdit} className="btn-primary">
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mounted &&
        deleting &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <button
              className="absolute inset-0"
              onClick={() => {
                setDeleting(null);
                setOtpSent(false);
              }}
              aria-label="Close delete modal"
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border animate-rm-in">
              <h3 className="font-semibold text-rose-700">
                Delete {deleting.name}?
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Director verification: type slug, type DELETE, then send a
                6-digit code to your email. Accounts remain — only project data
                is removed and emailed to you for audit.
              </p>
              <label className="text-xs font-medium text-slate-700 mt-3 block normal-case tracking-normal">
                Type slug{" "}
                <span className="font-mono bg-slate-100 px-1 rounded normal-case">
                  {deleting.slug}
                </span>{" "}
                to confirm
              </label>
              <input
                className="input mt-1"
                value={delSlug}
                onChange={(e) => setDelSlug(e.target.value)}
                placeholder={deleting.slug}
                autoComplete="off"
              />
              <label className="text-xs font-medium text-slate-700 mt-3 block normal-case tracking-normal">
                Type DELETE
              </label>
              <input
                className="input mt-1"
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={sendDeleteOtp}
                  disabled={otpSending}
                  type="button"
                  className="btn-secondary border-[#ec3013]/20 bg-red-50 text-[#ec3013] hover:bg-red-100 hover:border-[#ec3013]/30 text-xs font-semibold disabled:opacity-50"
                >
                  {otpSending
                    ? "Sending…"
                    : otpSent
                      ? "Resend code"
                      : "Send code to email"}
                </button>
                {otpSent && (
                  <span className="text-xs font-medium text-emerald-600">
                    ✓ Code sent (valid 10 min)
                  </span>
                )}
              </div>
              <label className="text-xs font-medium text-slate-700 mt-4 block normal-case tracking-normal">
                Code from email (Google Director) or password (Email Director)
              </label>
              <input
                className="input"
                value={delOtp}
                onChange={(e) => setDelOtp(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
              />
              <input
                className="input mt-2"
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                placeholder="Or password if Email account"
              />
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setDeleting(null);
                    setOtpSent(false);
                  }}
                  disabled={deletingBusy}
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doDelete}
                  disabled={deletingBusy}
                  className="btn-danger disabled:opacity-50 min-w-[148px]"
                >
                  {deletingBusy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
