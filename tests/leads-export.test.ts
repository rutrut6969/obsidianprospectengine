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
} as never;

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
  assert.equal(rows[0].googlePlaceId, undefined);
  assert.equal(rows[0].originalSavedLeadId, undefined);

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
