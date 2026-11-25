import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { UnifiedAuth } from "@/components/auth/unified-auth";

export const metadata: Metadata = {
  title: "Choose your role — LUCOUS",
  description: "Choose your role to continue to LUCOUS.",
};

export default function Page() {
  return (
    <AuthLayout showChangeRole={false} containerClassName="max-w-3xl">
      <UnifiedAuth view="role" />
    </AuthLayout>
  );
}
