import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";
import { hasAnyUser } from "@/lib/setup";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: `Set up ${PRODUCT_NAME}` };

export default async function SetupPage() {
  // Gate on "no users" alone would evict the admin mid-wizard: the
  // "Configure services" step's Save buttons re-render this page, and by
  // then createFirstAdmin already ran, so hasAnyUser() is true. The session
  // check keeps a still-signed-in admin on the wizard.
  if (!(await getCurrentSession()) && (await hasAnyUser())) {
    redirect("/login");
  }

  return <SetupWizard />;
}
