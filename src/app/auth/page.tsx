import { redirect } from "next/navigation";

// /auth is now /auth/login (older links and redirects keep working).
export default function AuthPage() {
  redirect("/auth/login");
}
