"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPasswordAction } from "@/app/actions/auth";
import { PasswordInput } from "@/components/common/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

// Must match `emailAndPassword.minPasswordLength` in lib/auth.ts.
const MIN_PASSWORD_LENGTH = 8;

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const busy = pending || submitting;

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function validate(): string | null {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (newPassword.length > 128) {
      return "Password must be at most 128 characters.";
    }
    if (newPassword !== confirmPassword) {
      return "Passwords do not match.";
    }
    if (hasPassword && !currentPassword) {
      return "Enter your current password.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validate();
    setError(invalid);
    if (invalid) {
      return;
    }

    if (!hasPassword) {
      // `setPassword` is a server-only Better Auth endpoint.
      startTransition(async () => {
        const result = await setPasswordAction(newPassword);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        reset();
        toast.success("Password set", {
          description: "You can now sign in with your email and password.",
        });
      });
      return;
    }

    setSubmitting(true);
    // Keeps THIS session alive and signs out every other device.
    const { error: err } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSubmitting(false);

    if (err) {
      setError(
        authErrorMessage(
          err.code,
          err.message ?? "Could not change your password."
        )
      );
      return;
    }
    reset();
    toast.success("Password changed", {
      description: "Your other devices have been signed out.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {hasPassword ? "Change Password" : "Set a Password"}
        </CardTitle>
        <CardDescription>
          {hasPassword
            ? "Choose a new password. Your other devices will be signed out."
            : "You currently sign in with a magic link or Google. Add a password to sign in with your email as well."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex max-w-sm flex-col gap-4" onSubmit={onSubmit}>
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput
                autoComplete="current-password"
                disabled={busy}
                id="current-password"
                onChange={(e) => setCurrentPassword(e.target.value)}
                value={currentPassword}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              autoComplete="new-password"
              disabled={busy}
              id="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={newPassword}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              autoComplete="new-password"
              disabled={busy}
              id="confirm-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              value={confirmPassword}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-fit gap-2"
            disabled={busy}
            size="sm"
            type="submit"
          >
            {busy && <Spinner className="size-4" />}
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
