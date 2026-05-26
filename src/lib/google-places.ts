/**
 * Google Places API (New) integration.
 * Requires GOOGLE_PLACES_API_KEY in environment.
 * @see https://developers.google.com/maps/documentation/places/web-service
 */

export interface PlaceSearchParams {
  category: string;
  city: string;
  state: string;
  radiusMeters: number;
  maxResults: number;
}

export interface PlaceLeadResult {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  types: string[];
}

interface TextSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
    types?: string[];
    addressComponents?: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
  }>;
  nextPageToken?: string;
}

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not set. Add it to your .env file to enable lead search."
    );
  }
  return key;
}

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function parseAddressComponents(
  components: AddressComponent[] | undefined
): { city: string | null; state: string | null } {
  let city: string | null = null;
  let state: string | null = null;
  for (const c of components ?? []) {
    if (c.types?.includes("locality")) city = c.longText ?? null;
    if (c.types?.includes("administrative_area_level_1"))
      state = c.shortText ?? c.longText ?? null;
  }
  return { city, state };
}

/** Text Search (New) — legal Places API usage, no HTML scraping. */
export async function searchPlaces(
  params: PlaceSearchParams
): Promise<PlaceLeadResult[]> {
  const apiKey = getApiKey();
  const textQuery = `${params.category} in ${params.city}, ${params.state}`;
  const results: PlaceLeadResult[] = [];
  let pageToken: string | undefined;

  while (results.length < params.maxResults) {
    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(20, params.maxResults - results.length),
      locationBias: {
        circle: {
          center: await geocodeCity(params.city, params.state, apiKey),
          radius: params.radiusMeters,
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.rating",
            "places.userRatingCount",
            "places.businessStatus",
            "places.types",
            "places.addressComponents",
            "nextPageToken",
          ].join(","),
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Places API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as TextSearchResponse;

    for (const place of data.places ?? []) {
      if (!place.id || !place.displayName?.text) continue;
      const { city, state } = parseAddressComponents(place.addressComponents);
      results.push({
        placeId: place.id,
        name: place.displayName.text,
        category: params.category,
        address: place.formattedAddress ?? null,
        city: city ?? params.city,
        state: state ?? params.state,
        phone:
          place.nationalPhoneNumber ??
          place.internationalPhoneNumber ??
          null,
        websiteUrl: place.websiteUri ?? null,
        googleMapsUrl: place.googleMapsUri ?? null,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        businessStatus: place.businessStatus ?? null,
        types: place.types ?? [],
      });
      if (results.length >= params.maxResults) break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken || results.length >= params.maxResults) break;
    // Google requires a short delay before using nextPageToken
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

async function geocodeCity(
  city: string,
  state: string,
  apiKey: string
): Promise<{ latitude: number; longitude: number }> {
  const address = encodeURIComponent(`${city}, ${state}, USA`);
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${apiKey}`
  );
  const data = (await res.json()) as {
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    status?: string;
  };
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) {
    throw new Error(`Could not geocode ${city}, ${state}. Check city/state spelling.`);
  }
  return { latitude: loc.lat, longitude: loc.lng };
}

/** Miles to meters for Places location bias */
export function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}
