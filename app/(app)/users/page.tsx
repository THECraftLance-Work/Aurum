import Link from "next/link";
import { Eye } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import UserActionRow from "@/components/users/UserActionRow";
import DeleteUserButton from "@/components/users/DeleteUserButton";
import { formatDate, roleAccent, roleLabels } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import AddEmployeeButton from "@/components/users/AddEmployeeButton";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireRole(["ADMIN", "DIRECTOR"]);
  const supabase = await createSupabaseServer();
  const { data: users } = await supabase
    .from("app_users")
    .select("id, name, email, role, status, auth_provider, created_at, assigned_project_id")
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug")
    .eq("is_active", true);
  const projectNames = new Map((projects ?? []).map((project: any) => [project.id, project.name]));

  const isDirector = currentUser.role === "DIRECTOR";

  return (
    <>
      <PageHeader title="Users" description="All accounts across the organization." actions={isDirector ? <AddEmployeeButton /> : undefined} />
      <div className="card p-0 overflow-hidden">
        <div className="max-h-[calc(100vh-220px)] overflow-auto overscroll-contain">
          <table className="hidden w-full min-w-[900px] text-sm 2xl:table">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => {
              const accent = roleAccent[u.role] ?? roleAccent.SM;
              const isSelf = u.id === currentUser.id;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link href={`/users/${u.id}`} className="flex items-center gap-3 group">
                      <div className={cn("grid h-9 w-9 place-items-center rounded-full text-white font-semibold transition group-hover:ring-2 group-hover:ring-offset-1", accent.dot, accent.ring)}>
                        {u.name.split(" ").slice(0,2).map((s: string) => s[0]?.toUpperCase()).join("")}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 flex items-center gap-2 group-hover:text-[#ec3013] group-hover:underline">
                          <span>{u.name}</span>
                          {isSelf && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">You</span>}
                        </div>
                        <div className="text-xs text-slate-500 group-hover:text-slate-700">{u.email}</div>
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          Project: <span className="text-slate-600">
                            {["ADMIN", "DIRECTOR"].includes(u.role)
                              ? "All Projects"
                              : u.assigned_project_id
                                ? projectNames.get(u.assigned_project_id) ?? "Selected project"
                                : "No project selected"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("badge border", accent.chip)}>{roleLabels[u.role]}</span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3 text-slate-500">{u.auth_provider}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/users/${u.id}`} title="Open profile (director view, Unique ID)" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        <Eye className="h-3.5 w-3.5" /> 
                      </Link>
                      <UserActionRow
                        userId={u.id}
                        userEmail={u.email}
                        currentStatus={u.status}
                        currentRole={u.role}
                        isSelf={isSelf}
                        isDirector={isDirector}
                      />
                      {isDirector && !isSelf && <DeleteUserButton userId={u.id} userName={u.name} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
          <div className="divide-y divide-border 2xl:hidden">
            {(users ?? []).map((u: any) => {
              const accent = roleAccent[u.role] ?? roleAccent.SM;
              const isSelf = u.id === currentUser.id;
              const projectName = ["ADMIN", "DIRECTOR"].includes(u.role)
                ? "All Projects"
                : u.assigned_project_id
                  ? projectNames.get(u.assigned_project_id) ?? "Selected project"
                  : "No project selected";
              return (
                <div key={u.id} className="space-y-4 p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Link href={`/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3 group">
                      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white font-semibold transition group-hover:ring-2 group-hover:ring-offset-1", accent.dot, accent.ring)}>
                        {u.name.split(" ").slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900 group-hover:text-[#ec3013]">
                          <span className="truncate">{u.name}</span>
                          {isSelf && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">You</span>}
                        </div>
                        <div className="truncate text-xs text-slate-500">{u.email}</div>
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          Project: <span className="text-slate-600">{projectName}</span>
                        </div>
                      </div>
                    </Link>
                    <StatusBadge status={u.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <div className="text-slate-400">Role</div>
                      <div className="mt-1"><span className={cn("badge border", accent.chip)}>{roleLabels[u.role]}</span></div>
                    </div>
                    <div>
                      <div className="text-slate-400">Provider</div>
                      <div className="mt-1 font-medium text-slate-700">{u.auth_provider}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Joined</div>
                      <div className="mt-1 font-medium text-slate-700">{formatDate(u.created_at)}</div>
                    </div>
                    <div className="flex items-end justify-start gap-2 sm:justify-end">
                      <Link href={`/users/${u.id}`} title="Open profile" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                      </Link>
                      <UserActionRow
                        userId={u.id}
                        userEmail={u.email}
                        currentStatus={u.status}
                        currentRole={u.role}
                        isSelf={isSelf}
                        isDirector={isDirector}
                      />
                      {isDirector && !isSelf && <DeleteUserButton userId={u.id} userName={u.name} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
