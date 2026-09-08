import { requireUser } from "@/lib/auth/session";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import ProjectPickerClient from "@/components/projects/ProjectPickerClient";

export const dynamic = "force-dynamic";

export default async function SriVarahaProjectsPage() {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  const { data: projects } = await admin.from("projects").select("id, slug, name, parent_id, is_active, default_sale_consideration, created_at").eq("is_active", true).order("name");
  const isAdmin = user.role === "ADMIN";
  const isDirector = user.role === "DIRECTOR";

  // Separate parent and children for colorful display
  const parent = projects?.find(p => p.slug === "sri-varaha");
  const children = projects?.filter(p => p.parent_id === parent?.id) ?? [];
  const orphans = projects?.filter(p => p.slug !== "sri-varaha" && p.parent_id !== parent?.id) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-[#ec3013] to-orange-500 p-[1px]">
        <div className="rounded-[15px] bg-gradient-to-br from-slate-900 via-[#1a1a1a] to-[#ec3013] p-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">SRIVARAHA / Projects</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Choose your Project</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">Dashboards, bookings and payments are isolated per project. SM / CP / Accountant work per-project, Admin & Director see all. Select a project to continue — you’ll be taken to its dashboard.</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-slate-900 shadow">
              <div className="text-xs text-slate-500">Current</div>
              <div className="text-sm font-semibold">{parent?.name ?? "Sri Varaha"}</div>
              <div className="text-xs text-slate-500">{children.length + orphans.length} active projects</div>
            </div>
          </div>
        </div>
      </div>

      <ProjectPickerClient projects={projects ?? []} isAdmin={isAdmin} isDirector={isDirector} />
    </div>
  );
}
