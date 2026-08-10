import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppearanceSettingsForm } from "@/components/profile/appearance-settings-form";
import { PageHeader } from "@/components/scaffold/page-header";
import { ThemeSettingsForm } from "@/components/workspace/theme-settings-form";
import { PRODUCT_NAME } from "@/config/platform";
import { auth } from "@/lib/auth";
import { getWorkspaceMembership } from "@/lib/permissions";

export const metadata = { title: `Theme — ${PRODUCT_NAME}` };

interface ThemePageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    redirect(`/${workspaceId}`);
  }

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        description="Choose the accent color for this workspace and how the app looks on your screen."
        eyebrow="Preferences"
        title="Theme"
      />

      <div className="space-y-6">
        <AppearanceSettingsForm />
        {isAdmin && <ThemeSettingsForm />}
      </div>
    </div>
  );
}
