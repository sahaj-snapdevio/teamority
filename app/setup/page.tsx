import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/config/platform";
import { hasAnyUser } from "@/lib/setup";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: `Set up ${PRODUCT_NAME}` };

export default async function SetupPage() {
  // Runs once: the wizard exists only while the instance has no users. As soon
  // as the first admin is created, /setup is gone.
  if (await hasAnyUser()) {
    redirect("/login");
  }

  return <SetupWizard />;
}
