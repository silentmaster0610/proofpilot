import { getUser } from "../lib/auth";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  if(!await getUser())redirect("/login");
  return <Dashboard />;
}
