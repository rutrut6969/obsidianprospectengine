"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Profile {
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  role: string;
  commissionRate: number;
  accountStatus: string;
}

export function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.user ?? null);
        setFullName(data.user?.fullName ?? "");
        setPhoneNumber(data.user?.phoneNumber ?? "");
      })
      .catch(() => setProfile(null));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phoneNumber }),
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json()).error ?? "Profile update failed");
      return;
    }
    const data = await res.json();
    setProfile(data.user);
  }

  return (
    <Card>
      <CardHeader title="Profile" description="Your lead generator profile and commission defaults" />
      <CardBody>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="profileName">Full name</Label>
            <Input id="profileName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="profilePhone">Phone</Label>
            <Input id="profilePhone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={saving}>Save Profile</Button>
          </div>
        </form>
        {profile && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Badge variant="purple">{profile.role.replace("_", " ")}</Badge>
            <Badge variant={profile.accountStatus === "ACTIVE" ? "green" : "amber"}>
              {profile.accountStatus}
            </Badge>
            <Badge variant="slate">{(profile.commissionRate * 100).toFixed(0)}% commission</Badge>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
