import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";
import { hasAnyUser } from "@/lib/setup";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: `Set up ${PRODUCT_NAME}` };

export default async function SetupPage() {
  // The wizard exists only while the instance has no users — EXCEPT for the
  // admin's own session mid-wizard: the "Configure services" step's Save
  // buttons are server actions, and Next.js re-renders this page after every
  // server action call. By then `createFirstAdmin` has already run, so
  // hasAnyUser() is true — without the session check below, every Save click
  // would re-trigger this gate and evict the admin to /login (which, since
  // they're still signed in, bounces on to /post-auth → /onboarding) instead
  // of leaving them on the wizard. An unauthenticated visitor after setup is
  // done still gets sent to /login as before.
  if (!(await getCurrentSession()) && (await hasAnyUser())) {
    redirect("/login");
  }

  return <SetupWizard />;
}
