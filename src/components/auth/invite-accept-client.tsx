"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Authorization failed");
      const redirectPath = data.redirectUrl
        ? new URL(data.redirectUrl).pathname + new URL(data.redirectUrl).search
        : `/setup-password?token=${token}`;
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <ShieldCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">
          Accept invitation
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Click below to authorize your email for Obsidian Prospect Engine.
          You&apos;ll then create your password.
        </p>
        {error && (
          <p className="text-sm text-red-300 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <Button className="w-full" loading={loading} onClick={handleAccept}>
          Authorize my email
        </Button>
      </CardBody>
    </Card>
  );
}
