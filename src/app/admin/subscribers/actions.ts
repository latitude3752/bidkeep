"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSeat, revokeSeat } from "@/lib/subscriber-seats";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { requireAdminSession } from "@/lib/admin-auth";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com").replace(/\/$/, "");
}

function errorRedirect(err: unknown): never {
  const message = err instanceof Error ? err.message : "Failed to update seat";
  redirect(`/admin/subscribers?error=${encodeURIComponent(message)}`);
}

export async function provisionSeat(formData: FormData): Promise<void> {
  await requireAdminSession();
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const company = String(formData.get("company") ?? "");
  const roleRaw = String(formData.get("role") ?? "owner");
  const role = roleRaw === "member" ? "member" : "owner";
  const untilRaw = String(formData.get("active_until") ?? "").trim();
  const activeUntil = untilRaw ? new Date(untilRaw) : undefined;

  let created;
  try {
    created = await createSeat({ email, name, company, role, activeUntil });
  } catch (err) {
    errorRedirect(err);
  }

  const emailSent = await sendWelcomeEmail({
    to: created.email,
    password: created.password,
    siteUrl: siteUrl(),
  });

  revalidatePath("/admin/subscribers");
  redirect(
    `/admin/subscribers?created=1&email=${encodeURIComponent(created.email)}&password=${encodeURIComponent(created.password)}&emailSent=${emailSent ? "1" : "0"}`
  );
}

export async function revokeSeatAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "").trim();
  try {
    await revokeSeat(id);
  } catch (err) {
    errorRedirect(err);
  }
  revalidatePath("/admin/subscribers");
  redirect("/admin/subscribers");
}
