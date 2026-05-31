"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { saveSearchResults } from "@/lib/search-session";
import { SearchLeadResult } from "@/types/lead";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const CATEGORIES = [
  "plumber",
  "electrician",
  "HVAC contractor",
  "roofing contractor",
  "landscaping",
  "auto repair",
  "dentist",
  "restaurant",
  "hair salon",
  "bakery",
  "law firm",
  "real estate agent",
  "cleaning service",
  "pest control",
  "painting contractor",
];

export function LeadSearchForm() {
  const router = useRouter();
  const [category, setCategory] = useState("plumber");
  const [customCategory, setCustomCategory] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [radius, setRadius] = useState(10);
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const queryCategory =
      category === "custom" ? customCategory.trim() : category;

    if (!queryCategory || !city.trim() || !state) {
      setError("Please fill in category, city, and state.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/search-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: queryCategory,
          city: city.trim(),
          state,
          radius,
          maxResults,
          auditWebsites: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");

      const leads = data.leads as SearchLeadResult[];
      saveSearchResults(leads, {
        category: queryCategory,
        city: city.trim(),
        state,
        radius,
        maxResults,
        searchRunId: data.searchRunId,
        searchedAt: new Date().toISOString(),
      });

      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Search Parameters"
        description="Uses Google Places API (Text Search). Requires GOOGLE_PLACES_API_KEY."
      />
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 text-left sm:px-6 md:hidden"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-sm font-semibold text-slate-100">Add Lead Search</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <CardBody className={`${open ? "block" : "hidden"} md:block`}>
        <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="category">Business Category</Label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="custom">Custom category…</option>
            </Select>
          </div>

          {category === "custom" && (
            <div className="sm:col-span-2">
              <Label htmlFor="customCategory">Custom Category</Label>
              <Input
                id="customCategory"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. mobile dog grooming"
              />
            </div>
          )}

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Austin"
              required
            />
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <Select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="radius">Search Radius (miles)</Label>
            <Input
              id="radius"
              type="number"
              min={1}
              max={50}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="maxResults">Max Results</Label>
            <Input
              id="maxResults"
              type="number"
              min={1}
              max={60}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
            />
          </div>

          {error && (
            <div className="sm:col-span-2 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit" loading={loading} disabled={loading}>
              {loading ? "Searching & auditing…" : "Search Leads"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
