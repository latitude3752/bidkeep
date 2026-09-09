"use server";

import { redirect } from "next/navigation";
import { sendContactRequest, validateContactRequest } from "@/lib/contact-request";

export async function submitContactRequest(formData: FormData): Promise<void> {
  // Honeypot: real visitors never fill in a field named "website" hidden off
  // -screen; a bot filling every field it sees will. Silently pretend success
  // rather than telling the bot which check it tripped.
  if (String(formData.get("website") ?? "").trim()) {
    redirect("/start?sent=1");
  }

  const input = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    company: String(formData.get("company") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  const errors = validateContactRequest(input);
  if (Object.keys(errors).length > 0) {
    redirect("/start?error=invalid");
  }

  const sent = await sendContactRequest(input);
  redirect(sent ? "/start?sent=1" : "/start?error=send-failed");
}
