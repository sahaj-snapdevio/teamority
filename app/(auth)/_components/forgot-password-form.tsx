"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircleIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onChange",
  });

  const { isSubmitting, isValid } = form.formState;

  async function onSubmit({ email }: FormData) {
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    // Always report success. Better Auth returns success regardless of whether
    // the address exists; surfacing an error here would leak account existence.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircleIcon className="size-6 text-primary" weight="duotone" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-base-content">Check your inbox</h2>
          <p className="text-sm leading-relaxed text-base-content/70">
            If an account exists for{" "}
            <span className="font-semibold text-base-content">{form.getValues("email")}</span>, we sent
            it a link to reset the password. The link expires in 1 hour.
          </p>
        </div>
        <p className="text-base-content/60 text-xs">
          <Link href="/login" className="underline underline-offset-4 transition-colors hover:text-base-content">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-base-content">Email address</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" className="h-11 rounded-lg font-medium text-base-content" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="h-11 w-full gap-2 rounded-lg text-sm font-semibold shadow-sm disabled:bg-base-200 disabled:text-base-content/60 disabled:opacity-100 disabled:shadow-none"
        >
          {isSubmitting ? (
            <><Spinner className="size-4" />Sending…</>
          ) : (
            <><PaperPlaneTiltIcon className="size-4" />Send reset link</>
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
