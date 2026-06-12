import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How SolarQuote handles your electricity bill, the data we read from it, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
        Privacy policy
      </p>
      <h1 className="mt-4 text-4xl sm:text-5xl">
        Your bill is yours. Here is exactly what we do with it.
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated June 12, 2026
      </p>

      <div className="mt-12 flex max-w-[70ch] flex-col gap-10 leading-relaxed">
        <section aria-labelledby="privacy-collect">
          <h2 id="privacy-collect" className="text-2xl">
            What we collect
          </h2>
          <p className="mt-3 text-muted-foreground">
            When you upload an electricity bill, we store the file and the
            details we read from it: energy consumption, billed amount,
            currency, billing period, the utility&apos;s name, and the service
            address. If you confirm your roof on the map, we store that
            location. If you ask for installer quotes, we store the contact
            details you type into the lead form: your name, email, and phone
            number if you choose to give it.
          </p>
          <p className="mt-3 text-muted-foreground">
            Electricity bills contain personal information. We treat the whole
            bill as personal data, not just the obvious fields.
          </p>
        </section>

        <section aria-labelledby="privacy-use">
          <h2 id="privacy-use" className="text-2xl">
            What we use it for
          </h2>
          <p className="mt-3 text-muted-foreground">
            One thing: producing your solar estimate. Your bill is processed by
            our document-reading providers (OCR and language-model services)
            solely to extract the fields above. Your roof location is sent to
            public solar irradiance services (PVGIS, NASA POWER) as
            coordinates, never with your name or bill attached.
          </p>
          <p className="mt-3 text-muted-foreground">
            We never sell your data. We share your contact details with a
            solar installer only when you explicitly ask for quotes, and only
            then.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention" className="text-2xl">
            How long we keep it
          </h2>
          <p className="mt-3 text-muted-foreground">
            Estimate sessions and uploaded bills are kept so you can return to
            your results and so we can hand a complete picture to an installer
            if you request quotes. You can have everything deleted at any time:
            write to us through the{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact page
            </Link>{" "}
            and we will remove your bill, the extracted data, and any lead
            record within 30 days.
          </p>
        </section>

        <section aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies" className="text-2xl">
            Cookies and tracking
          </h2>
          <p className="mt-3 text-muted-foreground">
            The estimate flow works without an account and without advertising
            trackers. We use only what is technically necessary to keep your
            estimate session together while you move through the steps.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact" className="text-2xl">
            Questions or deletion requests
          </h2>
          <p className="mt-3 text-muted-foreground">
            Use the{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact form
            </Link>
            . Deletion requests are honored without argument; you do not need
            to give a reason.
          </p>
        </section>
      </div>
    </article>
  );
}
