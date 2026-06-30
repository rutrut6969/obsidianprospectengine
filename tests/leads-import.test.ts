import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  parseImportedLeadFileFromBuffer,
  parseImportedLeadRowsFromBuffer,
  validateImportFile,
} from "../src/lib/import/leads-import";

test("parses stable JSON saved-leads export rows", () => {
  const buffer = Buffer.from(JSON.stringify({
    leads: [
      {
        businessName: "Imported Plumbing",
        category: "plumber",
        phone: "555-0199",
        primaryEmail: "OWNER@EXAMPLE.COM",
        website: "https://example.com",
        facebookUrl: "https://facebook.com/importedplumbing",
        city: "Austin",
        state: "tx",
        leadScore: 91,
        tags: ["hot", "imported"],
        googlePlaceId: "place-123",
        originalSavedLeadId: "lead-abc",
      },
    ],
  }));

  const rows = parseImportedLeadRowsFromBuffer(buffer, "leads.json");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, "Imported Plumbing");
  assert.equal(rows[0].primaryEmail, "owner@example.com");
  assert.equal(rows[0].state, "TX");
  assert.deepEqual(rows[0].tags, ["hot", "imported"]);
});

test("parses CSV exported header names", () => {
  const csv = [
    "Business Name,Category,Phone,Email,Website,Facebook Page,Address,City,State,Website Status,Lead Score,Rating,Reviews,Contact Status,Notes,Tags,Created/Saved Date,Last Contacted Date",
    "CSV Plumbing,plumber,555-0101,hi@example.com,,https://facebook.com/csvplumbing,1 Main St,Dallas,TX,FACEBOOK_ONLY,90,4.7,12,SAVED,Call soon,\"one; two\",2026-06-01,2026-06-20",
  ].join("\n");

  const rows = parseImportedLeadRowsFromBuffer(Buffer.from(csv, "utf8"), "leads.csv");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, "CSV Plumbing");
  assert.equal(rows[0].facebookUrl, "https://facebook.com/csvplumbing");
  assert.equal(rows[0].leadScore, 90);
  assert.equal(rows[0].rating, 4.7);
  assert.equal(rows[0].reviewCount, 12);
  assert.match(rows[0].createdAt ?? "", /^2026-06-01T/);
  assert.match(rows[0].lastContactedAt ?? "", /^2026-06-20T/);
  assert.deepEqual(rows[0].tags, ["one", "two"]);
});

test("parses XLSX exports with blank optional fields", () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      "Business Name": "Blank Optional LLC",
      Category: "",
      Phone: "",
      Email: "",
      Website: "",
      "Facebook Page": "",
      Address: "",
      City: "Tulsa",
      State: "OK",
      "Website Status": "",
      "Lead Score": "",
      Rating: "",
      Reviews: "",
      "Contact Status": "",
      Notes: "",
      Tags: "",
      "Created/Saved Date": "",
      "Last Contacted Date": "",
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Saved Leads");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const rows = parseImportedLeadRowsFromBuffer(buffer, "saved-leads.xlsx");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, "Blank Optional LLC");
  assert.equal(rows[0].city, "Tulsa");
  assert.equal(rows[0].leadScore, null);
  assert.equal(rows[0].rating, null);
  assert.equal(rows[0].reviewCount, null);
});

test("counts invalid numeric rows without dropping total row count", () => {
  const csv = [
    "Business Name,City,State,Lead Score,Rating,Reviews",
    "Good Lead,Austin,TX,85,4.2,10",
    "Bad Lead,Austin,TX,120,4.2,10",
  ].join("\n");

  const parsed = parseImportedLeadFileFromBuffer(Buffer.from(csv, "utf8"), "leads.csv");
  assert.equal(parsed.totalRows, 2);
  assert.equal(parsed.leads.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /Lead Score must be between 0 and 100/);
});

test("rejects unsupported import file types and oversized files", () => {
  assert.throws(() => validateImportFile("leads.pdf", 100), /Unsupported import file type/);
  assert.throws(() => validateImportFile("leads.csv", 6 * 1024 * 1024), /too large/);
});

test("reports missing required businessName column", () => {
  const csv = ["Email,Phone", "hi@example.com,555-0101"].join("\n");
  assert.throws(
    () => parseImportedLeadRowsFromBuffer(Buffer.from(csv, "utf8"), "leads.csv"),
    /Missing required column: businessName/
  );
});

test("empty CSV imports parse as no leads", () => {
  const rows = parseImportedLeadRowsFromBuffer(Buffer.from("Business Name,Email\n", "utf8"), "leads.csv");
  assert.equal(rows.length, 0);
});
