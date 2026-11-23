import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { UnifiedAuth } from "@/components/auth/unified-auth";

export const metadata: Metadata = {
  title: "Log in — LUCOUS",
  description: "Log in, then choose your role to continue to LUCOUS.",
};

export default function AuthPage() {
  return (
    <AuthLayout showChangeRole={false} containerClassName="max-w-3xl">
      <UnifiedAuth />
    </AuthLayout>
  );
}