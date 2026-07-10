import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, normalizeExternalUrl } from "../src/utils.js";

test("escapeHtml escapes &, <, and \" (but not >, by design)", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & tags`), '&lt;script>alert(&quot;x&quot;)&lt;/script> &amp; tags');
});

test("escapeHtml treats null/undefined as empty string", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml coerces non-string values", () => {
  assert.equal(escapeHtml(42), "42");
});

test("normalizeExternalUrl returns empty string for empty input", () => {
  assert.equal(normalizeExternalUrl(""), "");
  assert.equal(normalizeExternalUrl(null), "");
});

test("normalizeExternalUrl leaves http(s) URLs untouched", () => {
  assert.equal(normalizeExternalUrl("https://example.com"), "https://example.com");
  assert.equal(normalizeExternalUrl("http://example.com"), "http://example.com");
});

test("normalizeExternalUrl prefixes bare domains with https://", () => {
  assert.equal(normalizeExternalUrl("example.com"), "https://example.com");
  assert.equal(normalizeExternalUrl("github.com/username"), "https://github.com/username");
});

test("normalizeExternalUrl trims whitespace", () => {
  assert.equal(normalizeExternalUrl("  example.com  "), "https://example.com");
});
