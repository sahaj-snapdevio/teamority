"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { IntegrationSettingsSummary } from "@/lib/integration-settings";
import { GoogleOAuthSettingsForm } from "./google-oauth-settings-form";
import { SmtpSettingsForm } from "./smtp-settings-form";
import { StorageSettingsForm } from "./storage-settings-form";
import { WebPushSettingsForm } from "./web-push-settings-form";

interface Props {
  /** Whether the running process actually loaded the currently-saved Google
   * OAuth credentials at boot — see isGoogleOAuthLive() (lib/auth.ts). */
  googleOAuthLive: boolean;
  settings: IntegrationSettingsSummary;
}

/** Groups the four provider cards into an admin-console-style page: section
 * headings, and one lifted `expanded` id so only one provider's form is open
 * at a time across the whole page (not just within a section). Each card
 * manages its own <Accordion> internally (see integration-card.tsx) — this
 * just controls it via `open`/`onOpenChange`. */
export function IntegrationsConsole({ settings, googleOAuthLive }: Props) {
  const [expanded, setExpanded] = useState<string | undefined>();

  function toggle(id: string) {
    return (open: boolean) => setExpanded(open ? id : undefined);
  }

  return (
    <div className="space-y-8">
      <ProviderGroup title="Authentication">
        <GoogleOAuthSettingsForm
          googleOAuthLive={googleOAuthLive}
          initial={settings.google}
          onOpenChange={toggle("google")}
          open={expanded === "google"}
        />
      </ProviderGroup>

      <ProviderGroup title="Communication">
        <SmtpSettingsForm
          initial={settings.smtp}
          onOpenChange={toggle("smtp")}
          open={expanded === "smtp"}
        />
      </ProviderGroup>

      <ProviderGroup title="Storage">
        <StorageSettingsForm
          initial={settings.storage}
          onOpenChange={toggle("storage")}
          open={expanded === "storage"}
        />
      </ProviderGroup>

      <ProviderGroup title="Notifications">
        <WebPushSettingsForm
          initial={settings.webPush}
          onOpenChange={toggle("webPush")}
          open={expanded === "webPush"}
        />
      </ProviderGroup>
    </div>
  );
}

function ProviderGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 px-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
