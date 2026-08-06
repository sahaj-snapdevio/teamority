import { OrbitPageHeader } from "@/components/admin/orbit-page-header";
import { IntegrationsConsole } from "@/components/orbit/integrations/integrations-console";
import { isGoogleOAuthLive } from "@/lib/auth";
import { getIntegrationSettingsSummary } from "@/lib/integration-settings";

export const metadata = {
  title: "Integrations",
};

// Settings queried here must be per-request, not build-time.
export const dynamic = "force-dynamic";

export default async function OrbitIntegrationsPage() {
  const [settings, googleOAuthLive] = await Promise.all([
    getIntegrationSettingsSummary(),
    isGoogleOAuthLive(),
  ]);

  return (
    <div>
      <OrbitPageHeader
        description="Optional — the app works without any of these. Configure what you need here instead of editing .env; everything below applies live except Google OAuth, which needs a restart."
        eyebrow="Admin"
        title="Integrations"
      />
      <div className="max-w-5xl">
        <IntegrationsConsole
          googleOAuthLive={googleOAuthLive}
          settings={settings}
        />
      </div>
    </div>
  );
}
