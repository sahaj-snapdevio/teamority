"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/common/password-input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const MIN_PASSWORD_LENGTH = 8;

const schema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const { isSubmitting, isValid } = form.formState;

  async function onSubmit({ password }: FormData) {
    form.clearErrors("root");

    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      form.setError("root", { message: authErrorMessage(error.code, error.message) });
      return;
    }

    // `revokeSessionsOnPasswordReset` already signed out every device.
    setDone(true);
    toast.success("Password updated", { description: "Sign in with your new password." });
    router.push("/login");
  }

  if (done) {
    return (
      <p className="py-6 text-center text-sm text-base-content/70">
        Password updated. Redirecting you to sign in…
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-base-content">New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} className="h-11 rounded-lg font-medium text-base-content" {...field} />
              </FormControl>
              <FormDescription className="text-xs">
                For your security, all devices will be signed out.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-base-content">Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder="Re-enter your password" className="h-11 rounded-lg font-medium text-base-content" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="h-11 w-full gap-2 rounded-lg text-sm font-semibold shadow-sm disabled:bg-base-200 disabled:text-base-content/60 disabled:opacity-100 disabled:shadow-none"
        >
          {isSubmitting ? (
            <><Spinner className="size-4" />Updating…</>
          ) : (
            <><KeyIcon className="size-4" />Set new password</>
          )}
        </Button>

        <p className="pt-1 text-center text-sm text-base-content/70">
          <Link href="/login" className="font-semibold text-base-content underline underline-offset-4 transition-opacity hover:opacity-80">
            Back to sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
