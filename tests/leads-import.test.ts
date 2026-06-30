import assert from "node:assert/strict";
import test from "node:test";
import {
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
    "Business Name,Category,Phone,Email,Website,Facebook Page,City,State,Lead Score,Contact Status,Tags",
    "CSV Plumbing,plumber,555-0101,hi@example.com,,https://facebook.com/csvplumbing,Dallas,TX,90,SAVED,\"one; two\"",
  ].join("\n");

  const rows = parseImportedLeadRowsFromBuffer(Buffer.from(csv, "utf8"), "leads.csv");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, "CSV Plumbing");
  assert.equal(rows[0].facebookUrl, "https://facebook.com/csvplumbing");
  assert.equal(rows[0].leadScore, 90);
  assert.deepEqual(rows[0].tags, ["one", "two"]);
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

