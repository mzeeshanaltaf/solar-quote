"use client";

import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type Status = "idle" | "loading" | "error";

export function LoginForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setStatus("loading");
    setErrorMsg("");

    const { error } = await signIn.email({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message ?? "Those credentials didn't match. Please try again."
      );
      return;
    }

    // Hard navigation (not router.replace) so the request to the guarded
    // /admin route carries the just-set session cookie. A client-side
    // navigation can fire before Next's router/proxy sees the brand-new cookie,
    // which on a first login bounced to /admin/login until a manual refresh.
    window.location.assign("/admin");
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="admin-email">Email</FieldLabel>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@solarquote.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-password">Password</FieldLabel>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Couldn&apos;t sign in</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Field>
          <Button
            type="submit"
            size="lg"
            disabled={status === "loading" || !email.trim() || !password}
          >
            {status === "loading" && <Spinner data-icon="inline-start" />}
            {status === "loading" ? "Signing in" : "Sign in"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
