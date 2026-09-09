import { requireUser } from "@/lib/auth/session";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import ProjectPickerClient from "@/components/projects/ProjectPickerClient";

export const dynamic = "force-dynamic";

export default async function SriVarahaProjectsPage() {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  const { data: projects } = await admin.from("projects").select("id, slug, name, parent_id, is_active, logo_url, default_sale_consideration, default_areas, created_at").eq("is_active", true).order("name");
  const isAdmin = user.role === "ADMIN";
  const isDirector = user.role === "DIRECTOR";

  // Separate parent and children for colorful display
  const parent = projects?.find(p => p.slug === "sri-varaha");
  const children = projects?.filter(p => p.parent_id === parent?.id) ?? [];
  const orphans = projects?.filter(p => p.slug !== "sri-varaha" && p.parent_id !== parent?.id) ?? [];

  return (
    <div className="space-y-7 bg-[#F8FAFC]">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#173B73] via-[#243B80] to-[#5B2C83] p-px shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="relative overflow-hidden rounded-[23px] bg-gradient-to-br from-[#173B73] via-[#243B80] to-[#5B2C83] px-6 py-6 text-white sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full border-2 border-white/30 shadow-[0_0_70px_rgba(112,92,255,.8)]" />
          <div className="pointer-events-none absolute -bottom-32 right-32 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-[0.2em] text-white/75">SRIVARAHA / PROJECTS</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Choose <span className="bg-gradient-to-r from-[#DDE4FF] to-[#B9C5FF] bg-clip-text text-transparent">Your Project</span></h1>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-white/85">Dashboards, bookings and payments are isolated per project. SM / CP / Accountant work per-project, Admin & Director see all. Select a project to continue — you’ll be taken to its dashboard.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-white/90">
                {["Secure access", "Project-wise data", "Role-based dashboards", "Real-time updates"].map((item) => <span key={item} className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-white/90">{item}</span>)}
              </div>
            </div>
            <div className="relative rounded-xl bg-white px-4 py-3 text-[#172033] shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
              <div className="text-xs text-[#64748B]">Current workspace</div>
              <div className="mt-1 text-sm font-semibold">{parent?.name ?? "Sri Varaha"}</div>
              <div className="text-xs text-[#64748B]">{children.length + orphans.length} active projects</div>
            </div>
          </div>
        </div>
      </div>

      <ProjectPickerClient projects={projects ?? []} isAdmin={isAdmin} isDirector={isDirector} />
    </div>
  );
}
