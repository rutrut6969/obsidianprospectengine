import assert from "node:assert/strict";
import test from "node:test";
import {
  isQualifyingLead,
  MIN_VISIBLE_LEAD_SCORE,
  parseLeadSearchWebsiteFilter,
} from "../src/lib/search-filters";

test("requires search results to meet the minimum lead score", () => {
  assert.equal(MIN_VISIBLE_LEAD_SCORE, 85);
  assert.equal(isQualifyingLead({ leadScore: 84, websiteStatus: "NO_WEBSITE" }), false);
  assert.equal(isQualifyingLead({ leadScore: 85, websiteStatus: "BROKEN_WEBSITE" }), true);
});

test("filters qualifying leads by no website status", () => {
  assert.equal(
    isQualifyingLead({ leadScore: 100, websiteStatus: "NO_WEBSITE" }, "NO_WEBSITE"),
    true
  );
  assert.equal(
    isQualifyingLead({ leadScore: 90, websiteStatus: "FACEBOOK_ONLY" }, "NO_WEBSITE"),
    false
  );
});

test("filters qualifying leads by Facebook-only status", () => {
  assert.equal(
    isQualifyingLead({ leadScore: 90, websiteStatus: "FACEBOOK_ONLY" }, "FACEBOOK_ONLY"),
    true
  );
  assert.equal(
    isQualifyingLead({ leadScore: 100, websiteStatus: "NO_WEBSITE" }, "FACEBOOK_ONLY"),
    false
  );
});

test("parses unknown website filter values as all qualifying leads", () => {
  assert.equal(parseLeadSearchWebsiteFilter("NO_WEBSITE"), "NO_WEBSITE");
  assert.equal(parseLeadSearchWebsiteFilter("FACEBOOK_ONLY"), "FACEBOOK_ONLY");
  assert.equal(parseLeadSearchWebsiteFilter("BROKEN_WEBSITE"), "ALL");
  assert.equal(parseLeadSearchWebsiteFilter(undefined), "ALL");
});

