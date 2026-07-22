import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomFieldDefinitions } from "@/app/actions/custom-field";
import { CustomFieldsSettings } from "@/components/space/custom-fields-settings";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ workspaceId: string; spaceId: string }>;
}

export default async function CustomFieldsSettingsPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { workspaceId, spaceId } = await params;

  // Space-level definitions only — workspace-wide/list-scoped management is
  // out of scope for this minimal testing page (backend supports both).
  const res = await getCustomFieldDefinitions(workspaceId, spaceId, null, {
    includeArchived: true,
  });
  const fields = "error" in res ? [] : res.fields;

  return (
    <CustomFieldsSettings
      initialFields={fields}
      spaceId={spaceId}
      workspaceId={workspaceId}
    />
  );
}
