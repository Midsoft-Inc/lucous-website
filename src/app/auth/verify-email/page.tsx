import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { UnifiedAuth } from "@/components/auth/unified-auth";

export const metadata: Metadata = {
  title: "Verify your email — LUCOUS",
  description: "Confirm your email address to continue.",
};

export default function Page() {
  return (
    <AuthLayout showChangeRole={false} containerClassName="max-w-3xl">
      <UnifiedAuth view="verify-email" />
    </AuthLayout>
  );
}
