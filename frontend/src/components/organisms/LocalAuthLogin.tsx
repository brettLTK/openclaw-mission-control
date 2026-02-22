"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { setLocalAuthToken } from "@/auth/localAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LocalAuthLoginProps = {
  onAuthenticated?: () => void;
};

const defaultOnAuthenticated = () => window.location.reload();

export function LocalAuthLogin({ onAuthenticated }: LocalAuthLoginProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = passphrase.trim();
    if (!cleaned) {
      setError("Passphrase is required.");
      return;
    }

    setIsValidating(true);
    setError(null);

    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!rawBaseUrl) {
      setError("NEXT_PUBLIC_API_URL is not set.");
      setIsValidating(false);
      return;
    }

    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passphrase: cleaned }),
      });

      if (response.status === 200) {
        const data = await response.json();
        setLocalAuthToken(data.access_token);
        (onAuthenticated ?? defaultOnAuthenticated)();
        return;
      }

      if (response.status === 401) {
        setError("Invalid passphrase.");
      } else {
        setError("Unable to reach backend.");
      }
    } catch {
      setError("Unable to reach backend.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[color:var(--accent-soft)] blur-3xl" />
        <div className="absolute -right-28 -bottom-24 h-80 w-80 rounded-full bg-[rgba(14,165,233,0.12)] blur-3xl" />
      </div>

      <Card className="relative w-full max-w-lg animate-fade-in-up">
        <CardHeader className="space-y-5 border-b border-[color:var(--border)] pb-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Self-host mode
            </span>
            <div className="rounded-xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent)]">
              <Lock className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-strong">
              Local Authentication
            </h1>
            <p className="text-sm text-muted">
              Enter your passphrase to unlock Mission Control.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="local-auth-passphrase"
                className="text-xs font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Passphrase
              </label>
              <Input
                id="local-auth-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                disabled={isValidating}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isValidating}
            >
              {isValidating ? "Validating..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
