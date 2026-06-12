import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Suggestions, improvements, or questions about SolarQuote. We read everything.",
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid submission. Please try again.",
  fields: "Please fill in your name, email, and message.",
  email: "Please enter a valid email address.",
  length: "One of the fields is too long. The message is capped at 2000 characters.",
  rate: "Too many messages from your connection. Please wait a few minutes and try again.",
  server: "We could not deliver your message right now. Please try again shortly.",
};

interface ContactPageProps {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { sent, error } = await searchParams;
  const initialError = error
    ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.")
    : undefined;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
          Contact
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl">Tell us what we got wrong.</h1>
        <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">
          Suggestions, improvements, questions about your estimate, or a
          deletion request: it all lands in the same inbox, and a person reads
          it. No ticket numbers, no chatbots.
        </p>
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        <ContactForm initialSuccess={!!sent} initialError={initialError} />
      </div>
    </div>
  );
}
