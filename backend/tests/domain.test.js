import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDateRange,
  assertEnum,
  assertObjectId,
  assertPositiveNumber,
  normalizeNullableString,
  parsePagination,
} from "../src/utils/validation.js";
import { resolveInvoiceTransition } from "../src/services/invoice.service.js";

test("parsePagination clamps page and limit", () => {
  assert.deepEqual(parsePagination({ page: "0", limit: "999" }), {
    page: 1,
    limit: 100,
    skip: 0,
  });
});

test("applyDateRange adds createdAt bounds", () => {
  const filter = {};
  applyDateRange(filter, { from: "2026-01-01", to: "2026-01-31" });

  assert.ok(filter.createdAt.$gte instanceof Date);
  assert.ok(filter.createdAt.$lte instanceof Date);
});

test("validation helpers reject invalid values", () => {
  assert.throws(() => assertObjectId("bad-id", "invoiceId"), /Invalid invoiceId/);
  assert.throws(() => assertEnum("eur", ["ARS", "USD"], "currency"), /Invalid currency/);
  assert.throws(() => assertPositiveNumber(0, "amount"), /amount must be a positive number/);
  assert.equal(normalizeNullableString("  note  "), "note");
  assert.equal(normalizeNullableString("   "), null);
});

test("invoice transitions allow staff to mark paid only", () => {
  const pendingInvoice = { status: "pending" };

  assert.doesNotThrow(() => resolveInvoiceTransition(pendingInvoice, "paid", "staff"));
  assert.throws(
    () => resolveInvoiceTransition(pendingInvoice, "canceled", "staff"),
    /Only clinic_admin can cancel invoices/,
  );
  assert.throws(
    () => resolveInvoiceTransition(pendingInvoice, "overdue", "staff"),
    /Only clinic_admin can mark invoices as overdue/,
  );
});

test("invoice transitions block editing paid invoices", () => {
  assert.throws(
    () => resolveInvoiceTransition({ status: "paid" }, "pending", "clinic_admin"),
    /Paid invoices cannot be changed manually/,
  );
});
