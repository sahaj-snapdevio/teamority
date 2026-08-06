"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  saveIntegrationSettingsAction,
  testSmtpConnectionAction,
} from "@/app/actions/integrations";
import { PasswordInput } from "@/components/common/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntegrationSettingsSummary } from "@/lib/integration-settings";
import { IntegrationCard } from "./integration-card";

type Smtp = IntegrationSettingsSummary["smtp"];

interface Props {
  initial: Smtp;
  /** Controlled open state, forwarded to IntegrationCard — see its docs.
   * Unused by the setup wizard (rendered standalone inside a dialog). */
  onOpenChange?: (open: boolean) => void;
  /** Notified with the new configured state after a successful save/remove —
   * lets a compact summary card (e.g. the setup wizard) stay in sync without
   * re-fetching. Unused on /orbit/integrations. */
  onSaved?: (configured: boolean) => void;
  open?: boolean;
}

export function SmtpSettingsForm({
  initial,
  onSaved,
  open,
  onOpenChange,
}: Props) {
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [user, setUser] = useState(initial.user);
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState(initial.from);
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFailed, setTestFailed] = useState(false);

  const configured = !!(host && user && from && hasPassword);

  async function save(smtp: Record<string, unknown>, message: string) {
    const result = await saveIntegrationSettingsAction({ smtp });
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(message);
    return true;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const portNum = Number.parseInt(port, 10);
      const ok = await save(
        {
          host,
          port: Number.isFinite(portNum) ? portNum : undefined,
          user,
          from,
          pass: pass || undefined,
        },
        "SMTP settings saved."
      );
      if (ok) {
        if (pass) {
          setHasPassword(true);
        }
        setPass("");
        setTestFailed(false);
        onSaved?.(!!(host && user && from && (hasPassword || pass)));
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const portNum = Number.parseInt(port, 10);
      const result = await testSmtpConnectionAction({
        host,
        port: Number.isFinite(portNum) ? portNum : undefined,
        user,
        pass: pass || undefined,
      });
      if ("error" in result) {
        setTestFailed(true);
        toast.error(result.error);
      } else {
        setTestFailed(false);
        toast.success("Connection successful.");
      }
    } catch {
      setTestFailed(true);
      toast.error("Network error. Please try again.");
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const ok = await save(
        { host: "", port: 587, user: "", from: "", pass: "" },
        "SMTP settings removed."
      );
      if (ok) {
        setHost("");
        setPort("587");
        setUser("");
        setFrom("");
        setPass("");
        setHasPassword(false);
        setTestFailed(false);
        onSaved?.(false);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <IntegrationCard
      description="Send magic links, invites, and notification emails. Without it, emails are logged instead of delivered."
      icon={<EnvelopeSimpleIcon className="size-4.5" />}
      onOpenChange={onOpenChange}
      onRemove={handleRemove}
      onSave={handleSave}
      onTest={handleTest}
      open={open}
      removing={removing}
      saving={saving}
      status={
        testFailed ? "failed" : configured ? "configured" : "not-configured"
      }
      testing={testing}
      title="Email (SMTP)"
      value="smtp"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="smtp-host">Host</Label>
          <Input
            disabled={saving}
            id="smtp-host"
            onChange={(e) => {
              setHost(e.target.value);
              setTestFailed(false);
            }}
            placeholder="smtp.resend.com"
            value={host}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            disabled={saving}
            id="smtp-port"
            inputMode="numeric"
            onChange={(e) => {
              setPort(e.target.value);
              setTestFailed(false);
            }}
            placeholder="587"
            value={port}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="smtp-user">Username</Label>
          <Input
            disabled={saving}
            id="smtp-user"
            onChange={(e) => {
              setUser(e.target.value);
              setTestFailed(false);
            }}
            value={user}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-pass">Password</Label>
          <PasswordInput
            disabled={saving}
            id="smtp-pass"
            onChange={(e) => {
              setPass(e.target.value);
              setTestFailed(false);
            }}
            placeholder={
              hasPassword ? "Saved — leave blank to keep" : "Not set"
            }
            value={pass}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="smtp-from">From address</Label>
        <Input
          disabled={saving}
          id="smtp-from"
          onChange={(e) => setFrom(e.target.value)}
          placeholder="noreply@yourdomain.com"
          value={from}
        />
      </div>
    </IntegrationCard>
  );
}
