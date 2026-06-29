import assert from "node:assert/strict";
import test from "node:test";
import {
  getOutreachTestOverride,
  resolveOutreachEmailRecipient,
} from "../src/lib/outreach/email-config";

test("uses the lead primary email when no test override is active", () => {
  const recipient = resolveOutreachEmailRecipient(
    { primaryEmail: "owner@example.biz", contactMethods: [] },
    { NODE_ENV: "production" }
  );

  assert.deepEqual(recipient, {
    to: "owner@example.biz",
    isTestOverride: false,
    warning: null,
  });
});

test("ignores production test override unless explicitly allowed", () => {
  const env = {
    NODE_ENV: "production",
    OUTREACH_TEST_TO_EMAIL: "qa@example.com",
  };

  assert.equal(getOutreachTestOverride(env), null);
  assert.deepEqual(resolveOutreachEmailRecipient({ primaryEmail: "lead@example.com" }, env), {
    to: "lead@example.com",
    isTestOverride: false,
    warning: "OUTREACH_TEST_TO_EMAIL is set but ignored in production unless OUTREACH_ALLOW_TEST_OVERRIDE=true.",
  });
});

test("allows deliberate production test override", () => {
  const recipient = resolveOutreachEmailRecipient(
    { primaryEmail: "lead@example.com" },
    {
      NODE_ENV: "production",
      OUTREACH_TEST_TO_EMAIL: "qa@example.com",
      OUTREACH_ALLOW_TEST_OVERRIDE: "true",
    }
  );

  assert.deepEqual(recipient, {
    to: "qa@example.com",
    isTestOverride: true,
    warning: "OUTREACH_TEST_TO_EMAIL override is active. Real lead recipient was not used.",
  });
});

test("falls back to discovered primary or highest-confidence email", () => {
  const recipient = resolveOutreachEmailRecipient({
    primaryEmail: null,
    contactMethods: [
      { type: "EMAIL", value: "info@example.com", isPrimary: false, confidence: 80 },
      { type: "EMAIL", value: "owner@example.com", isPrimary: true, confidence: 70 },
    ],
  });

  assert.equal(recipient?.to, "owner@example.com");
});

