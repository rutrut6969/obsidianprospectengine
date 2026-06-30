import assert from "node:assert/strict";
import test from "node:test";
import {
  exportContentType,
  parseExportColumns,
  renderCsv,
  renderDocx,
  renderJson,
  renderPdf,
  renderXlsx,
  toImportableLeadRows,
  valueFor,
} from "../src/lib/export/leads-export";

const mockLead = {
  id: "lead-1",
  placeId: "place-1",
  name: "Example Plumbing",
  category: "plumber",
  phone: "555-0100",
  primaryEmail: "owner@example.com",
  websiteUrl: "https://facebook.com/exampleplumbing",
  address: "1 Main St",
  city: "Austin",
  state: "TX",
  websiteStatus: "FACEBOOK_ONLY",
  leadScore: 90,
  rating: 4.7,
  reviewCount: 12,
  status: "SAVED",
  notes: "Call next week",
  tags: ["hot", "owner"],
  createdAt: new Date("2026-06-01T12:00:00Z"),
  contactMethods: [],
  outreachLogs: [{ sentAt: new Date("2026-06-20T12:00:00Z") }],
  activities: [{ createdAt: new Date("2026-06-19T12:00:00Z") }],
} as any;

function makeLead(index: number) {
  const statuses = ["NO_WEBSITE", "FACEBOOK_ONLY", "HAS_WEBSITE", "CONTACTED"] as const;
  const websiteStatuses = ["NO_WEBSITE", "FACEBOOK_ONLY", "HAS_WEBSITE", "BROKEN_WEBSITE"] as const;
  const websiteStatus = websiteStatuses[index % websiteStatuses.length];
  const status = statuses[index % statuses.length] === "CONTACTED" ? "CONTACTED" : "SAVED";
  return {
    ...mockLead,
    id: `lead-${index}`,
    placeId: `place-${index}`,
    name: `Example Prospect ${index}`,
    category: index % 2 === 0 ? "plumber" : "roofer",
    phone: `555-01${String(index).padStart(2, "0")}`,
    primaryEmail: `owner${index}@example.com`,
    websiteUrl: websiteStatus === "NO_WEBSITE" ? null : `https://example-${index}.com`,
    city: index % 2 === 0 ? "Austin" : "Dallas",
    websiteStatus,
    leadScore: 85 + (index % 15),
    rating: index % 3 === 0 ? null : 4 + (index % 10) / 10,
    reviewCount: 10 + index,
    status,
    notes: `This is a sales-call-ready prospect note for lead ${index}. It should wrap naturally inside the lead card without forcing a spreadsheet cell layout.`,
    tags: ["packet", `batch-${index % 5}`],
    createdAt: new Date(`2026-06-${String((index % 28) + 1).padStart(2, "0")}T12:00:00Z`),
  } as never;
}

test("export content types are wired for every supported saved-lead format", () => {
  assert.equal(exportContentType("CSV"), "text/csv; charset=utf-8");
  assert.equal(
    exportContentType("XLSX"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  assert.equal(exportContentType("JSON"), "application/json; charset=utf-8");
  assert.equal(
    exportContentType("DOCX"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(exportContentType("PDF"), "application/pdf");
});

test("saved lead export columns include requested CRM fields", () => {
  const columns = parseExportColumns(null);
  assert.deepEqual(columns, [
    "name",
    "category",
    "phone",
    "primaryEmail",
    "websiteUrl",
    "facebookPage",
    "address",
    "city",
    "state",
    "websiteStatus",
    "leadScore",
    "rating",
    "reviewCount",
    "status",
    "notes",
    "tags",
    "createdAt",
    "lastContactedAt",
  ]);
  assert.equal(columns.includes("placeId" as never), false);
  assert.equal(columns.includes("primaryEmail"), true);
  assert.equal(columns.includes("facebookPage"), true);
  assert.equal(columns.includes("tags"), true);
  assert.equal(columns.includes("createdAt"), true);
  assert.equal(columns.includes("lastContactedAt"), true);
});

test("computed export values include Facebook page, tags, and last contacted date", () => {
  assert.equal(valueFor(mockLead, "facebookPage"), "https://facebook.com/exampleplumbing");
  assert.equal(valueFor(mockLead, "tags"), "hot, owner");
  assert.equal(valueFor(mockLead, "createdAt"), "2026-06-01");
  assert.equal(valueFor(mockLead, "lastContactedAt"), "2026-06-20");
});

test("JSON export uses stable importable field names", () => {
  const rows = toImportableLeadRows([mockLead], new Date("2026-06-30T12:00:00Z"));
  assert.equal(rows[0].businessName, "Example Plumbing");
  assert.equal(rows[0].website, "https://facebook.com/exampleplumbing");
  assert.equal(rows[0].facebookUrl, "https://facebook.com/exampleplumbing");
  assert.equal(rows[0].googlePlaceId, "place-1");
  assert.equal(rows[0].originalSavedLeadId, "lead-1");

  const json = JSON.parse(renderJson([mockLead]).toString("utf8")) as { leads: unknown[] };
  assert.equal(Array.isArray(json.leads), true);
});

test("renders empty saved lead exports in every supported format", async () => {
  const columns = parseExportColumns("name,primaryEmail,facebookPage,lastContactedAt");

  assert.match(renderCsv([], columns).toString("utf8"), /Business Name/);
  assert.ok(renderXlsx([], columns).length > 0);
  assert.ok(renderJson([]).length > 0);
  assert.ok((await renderDocx([], columns)).length > 0);
  assert.equal((await renderPdf([], columns)).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renders readable PDF prospect packets at realistic lead counts", async () => {
  const columns = parseExportColumns(null);
  for (const count of [10, 50, 100]) {
    const leads = Array.from({ length: count }, (_, index) => makeLead(index + 1));
    const pdf = await renderPdf(leads, columns, {
      filters: { minScore: "85", websiteStatus: "NO_WEBSITE", sort: "leadScore" },
    });
    assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
    assert.ok(pdf.length > count * 300, `expected substantial PDF output for ${count} leads`);
  }
});
