import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { UnifiedAuth } from "@/components/auth/unified-auth";

export const metadata: Metadata = {
  title: "Sign up — LUCOUS",
  description: "Choose your role to create a LUCOUS account.",
};

export default function Page() {
  return (
    <AuthLayout showChangeRole={false} containerClassName="max-w-3xl">
      <UnifiedAuth view="signup" />
    </AuthLayout>
  );
}
