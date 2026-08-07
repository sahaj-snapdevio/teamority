"use client";

import { CloudIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  saveIntegrationSettingsAction,
  testStorageConnectionAction,
} from "@/app/actions/integrations";
import { PasswordInput } from "@/components/common/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntegrationSettingsSummary } from "@/lib/integration-settings";
import { IntegrationCard } from "./integration-card";
import { ENV_OVERRIDE_NOTE } from "./integration-status-badge";

type Storage = IntegrationSettingsSummary["storage"];
type Driver = Storage["driver"];

interface Props {
  initial: Storage;
  /** Controlled open state, forwarded to IntegrationCard — see its docs.
   * Unused by the setup wizard (rendered standalone inside a dialog). */
  onOpenChange?: (open: boolean) => void;
  /** Notified with the new configured state after a successful save —
   * lets a compact summary card (e.g. the setup wizard) stay in sync without
   * re-fetching. Unused on /orbit/integrations. */
  onSaved?: (configured: boolean) => void;
  open?: boolean;
  /** Whether the *resolved* s3/r2 config (DB, falling back to .env) is
   * usable — see isStorageConfiguredViaS3() (lib/integration-settings.ts).
   * Defaults to false, which is correct for the setup wizard. Local disk
   * doesn't need this: it's always usable with zero setup. */
  resolvedConfiguredViaS3?: boolean;
}

export function StorageSettingsForm({
  initial,
  onSaved,
  open,
  onOpenChange,
  resolvedConfiguredViaS3 = false,
}: Props) {
  const [driver, setDriver] = useState<Driver>(initial.driver);
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [region, setRegion] = useState(initial.region);
  const [bucket, setBucket] = useState(initial.bucket);
  const [publicUrl, setPublicUrl] = useState(initial.publicUrl);
  const [accessKeyId, setAccessKeyId] = useState(initial.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [hasSecretAccessKey, setHasSecretAccessKey] = useState(
    initial.hasSecretAccessKey
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFailed, setTestFailed] = useState(false);

  // Local disk works with zero setup, so it counts as "configured" on its
  // own; an s3/r2 driver additionally needs a bucket + credentials before
  // it's actually usable — either saved here or resolved via .env.
  const dbConfiguredS3 =
    driver !== "local" &&
    !!(bucket && accessKeyId && (hasSecretAccessKey || secretAccessKey));
  const usingEnv = !dbConfiguredS3 && resolvedConfiguredViaS3;
  const configured = driver === "local" || dbConfiguredS3 || usingEnv;

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testStorageConnectionAction({
        driver,
        endpoint,
        region,
        bucket,
        publicUrl,
        accessKeyId,
        secretAccessKey: secretAccessKey || undefined,
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

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveIntegrationSettingsAction({
        storage: {
          driver,
          endpoint,
          region,
          bucket,
          publicUrl,
          accessKeyId,
          secretAccessKey: secretAccessKey || undefined,
        },
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (secretAccessKey) {
        setHasSecretAccessKey(true);
      }
      setSecretAccessKey("");
      setTestFailed(false);
      toast.success("Storage settings saved.");
      onSaved?.(configured);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IntegrationCard
      description="Where avatars and task attachments are stored. Local disk needs no setup but requires a persistent Docker volume; S3/R2 survive host loss and work across replicas."
      icon={<CloudIcon className="size-4.5" />}
      note={usingEnv ? ENV_OVERRIDE_NOTE : undefined}
      onOpenChange={onOpenChange}
      onSave={handleSave}
      onTest={handleTest}
      open={open}
      saving={saving}
      status={
        testFailed ? "failed" : configured ? "configured" : "not-configured"
      }
      testing={testing}
      title="File Storage"
      usingEnv={usingEnv}
      value="storage"
    >
      <div className="space-y-1.5">
        <Label htmlFor="storage-driver">Driver</Label>
        <Select
          disabled={saving}
          onValueChange={(v) => {
            setDriver(v as Driver);
            setTestFailed(false);
          }}
          value={driver}
        >
          <SelectTrigger className="w-full" id="storage-driver">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local disk (default)</SelectItem>
            <SelectItem value="s3">S3-compatible</SelectItem>
            <SelectItem value="r2">Cloudflare R2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {driver !== "local" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="storage-bucket">Bucket</Label>
            <Input
              disabled={saving}
              id="storage-bucket"
              onChange={(e) => {
                setBucket(e.target.value);
                setTestFailed(false);
              }}
              value={bucket}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storage-region">
              Region{" "}
              <span className="font-normal text-base-content/60">
                (&ldquo;auto&rdquo; for R2)
              </span>
            </Label>
            <Input
              disabled={saving}
              id="storage-region"
              onChange={(e) => {
                setRegion(e.target.value);
                setTestFailed(false);
              }}
              placeholder="auto"
              value={region}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="storage-endpoint">
              Endpoint{" "}
              <span className="font-normal text-base-content/60">
                (R2/MinIO — omit for AWS S3)
              </span>
            </Label>
            <Input
              disabled={saving}
              id="storage-endpoint"
              onChange={(e) => {
                setEndpoint(e.target.value);
                setTestFailed(false);
              }}
              placeholder="https://<account-id>.r2.cloudflarestorage.com"
              value={endpoint}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storage-access-key">Access key ID</Label>
            <Input
              disabled={saving}
              id="storage-access-key"
              onChange={(e) => {
                setAccessKeyId(e.target.value);
                setTestFailed(false);
              }}
              value={accessKeyId}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storage-secret-key">Secret access key</Label>
            <PasswordInput
              disabled={saving}
              id="storage-secret-key"
              onChange={(e) => {
                setSecretAccessKey(e.target.value);
                setTestFailed(false);
              }}
              placeholder={
                hasSecretAccessKey ? "Saved — leave blank to keep" : "Not set"
              }
              value={secretAccessKey}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="storage-public-url">
              Public URL{" "}
              <span className="font-normal text-base-content/60">
                (optional — CDN/custom domain)
              </span>
            </Label>
            <Input
              disabled={saving}
              id="storage-public-url"
              onChange={(e) => setPublicUrl(e.target.value)}
              value={publicUrl}
            />
          </div>
        </div>
      )}
    </IntegrationCard>
  );
}
