"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeadsTable } from "@/components/search/leads-table";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadSearchResults } from "@/lib/search-session";
import { SearchLeadResult } from "@/types/lead";
import { Search } from "lucide-react";

export default function ResultsPage() {
  const [leads, setLeads] = useState<SearchLeadResult[]>([]);
  const [meta, setMeta] = useState<ReturnType<typeof loadSearchResults>["meta"]>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const { leads: stored, meta: storedMeta } = loadSearchResults();
    setLeads(stored);
    setMeta(storedMeta);
    setLoaded(true);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-purple-400">Results</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-100">Lead Results</h1>
          {meta && (
            <p className="mt-2 text-slate-400">
              {meta.category} · {meta.city}, {meta.state} · {meta.radius} mi ·{" "}
              <span className="text-emerald-400">{leads.length} leads</span>
            </p>
          )}
        </div>
        <Link href="/search">
          <Button variant="secondary">
            <Search className="h-4 w-4" />
            New Search
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Search Results"
          description={
            loaded && leads.length === 0
              ? "No results in session. Run a new search."
              : "Save high-priority leads to your CRM"
          }
        />
        <CardBody className="p-0">
          {!loaded ? (
            <p className="py-12 text-center text-slate-500">Loading…</p>
          ) : (
            <LeadsTable leads={leads} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
