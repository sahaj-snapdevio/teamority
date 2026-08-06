"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircleIcon, SignInIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GoogleIcon } from "@/components/common/google-icon";
import { PasswordInput } from "@/components/common/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import type { AuthMethods } from "@/lib/auth-config";
import { authErrorMessage, isUserExistsCode } from "@/lib/auth-errors";

// Must match `emailAndPassword.minPasswordLength` in lib/auth.ts. The server is
// the real gate; this only avoids a pointless round-trip.
const MIN_PASSWORD_LENGTH = 8;

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name")
      .max(100, "Name is too long"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      )
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function SignupForm({ methods }: { methods: AuthMethods }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const { isSubmitting, isValid } = form.formState;
  const busy = isSubmitting || googleLoading;

  async function handleGoogleSignIn() {
    form.clearErrors("root");
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/post-auth",
      });
    } catch {
      form.setError("root", {
        message: "Failed to sign in with Google. Please try again.",
      });
      setGoogleLoading(false);
    }
  }

  async function onSubmit({ name, email, password }: FormData) {
    form.clearErrors("root");

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email,
      password,
      callbackURL: "/post-auth",
    });

    if (error) {
      // Don't confirm whether an email is registered. The neutral confirmation
      // screen reads correctly whether or not the account already existed.
      if (isUserExistsCode(error.code) && methods.requiresEmailVerification) {
        setSent(true);
        return;
      }
      form.setError("root", {
        message: authErrorMessage(error.code, error.message),
      });
      return;
    }

    // With verification required, Better Auth does not create a session — the
    // user must confirm their email first.
    if (methods.requiresEmailVerification) {
      setSent(true);
      return;
    }

    router.push("/post-auth");
    router.refresh();
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircleIcon className="size-6 text-primary" weight="duotone" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Check your inbox
          </h2>
          <p className="text-sm leading-relaxed text-foreground/70">
            We sent a verification link to{" "}
            <span className="font-semibold text-foreground">
              {form.getValues("email")}
            </span>
            . Click it to finish setting up your account.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Already have an account?{" "}
          <Link
            className="underline underline-offset-4 transition-colors hover:text-foreground"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {methods.google && (
        <>
          <Button
            className="h-11 w-full gap-2 rounded-lg border-input text-foreground disabled:opacity-60"
            disabled={busy}
            onClick={handleGoogleSignIn}
            type="button"
            variant="outline"
          >
            {googleLoading ? (
              <Spinner className="size-4" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            {googleLoading ? "Connecting…" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">
              or sign up with email
            </span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <Form {...form}>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-foreground">
                  Full name
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    className="h-11 rounded-lg font-medium text-foreground"
                    placeholder="Ada Lovelace"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-foreground">
                  Email address
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="email"
                    className="h-11 rounded-lg font-medium text-foreground"
                    placeholder="you@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-foreground">
                  Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-11 rounded-lg font-medium text-foreground"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Use at least {MIN_PASSWORD_LENGTH} characters. A passphrase
                  works well.
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
                <FormLabel className="text-sm font-semibold text-foreground">
                  Confirm password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-11 rounded-lg font-medium text-foreground"
                    placeholder="Re-enter your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <Alert variant="destructive">
              <AlertDescription>
                {form.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="h-11 w-full gap-2 rounded-lg text-sm font-semibold shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
            disabled={!isValid || busy}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <Spinner className="size-4" />
                Creating account…
              </>
            ) : (
              <>
                <SignInIcon className="size-4" />
                Create account
              </>
            )}
          </Button>
        </form>
      </Form>

      <p className="pt-1 text-center text-sm text-foreground/70">
        Already have an account?{" "}
        <Link
          className="font-semibold text-foreground underline underline-offset-4 transition-opacity hover:opacity-80"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
