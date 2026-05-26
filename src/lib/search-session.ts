import { SearchLeadResult } from "@/types/lead";

const STORAGE_KEY = "ope_search_results";
const META_KEY = "ope_search_meta";

export interface SearchMeta {
  category: string;
  city: string;
  state: string;
  radius: number;
  maxResults: number;
  searchRunId?: string;
  searchedAt: string;
}

export function saveSearchResults(leads: SearchLeadResult[], meta: SearchMeta) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  sessionStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function loadSearchResults(): {
  leads: SearchLeadResult[];
  meta: SearchMeta | null;
} {
  if (typeof window === "undefined") return { leads: [], meta: null };
  try {
    const leads = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? "[]"
    ) as SearchLeadResult[];
    const meta = sessionStorage.getItem(META_KEY)
      ? (JSON.parse(sessionStorage.getItem(META_KEY)!) as SearchMeta)
      : null;
    return { leads, meta };
  } catch {
    return { leads: [], meta: null };
  }
}
