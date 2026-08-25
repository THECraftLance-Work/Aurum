import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending");
  redirect("/dashboard");
}
