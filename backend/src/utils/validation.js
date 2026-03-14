import mongoose from "mongoose";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const assert = (condition, status, message) => {
  if (!condition) {
    throw createHttpError(status, message);
  }
};

export const assertObjectId = (value, fieldName) => {
  assert(mongoose.Types.ObjectId.isValid(value), 400, `Invalid ${fieldName}`);
  return value;
};

export const assertRequiredFields = (fields) => {
  for (const [value, message] of fields) {
    assert(Boolean(value), 400, message);
  }
};

export const assertPositiveNumber = (value, fieldName) => {
  assert(typeof value === "number" && value > 0, 400, `${fieldName} must be a positive number`);
  return value;
};

export const assertEnum = (value, validValues, fieldName) => {
  assert(validValues.includes(value), 400, `Invalid ${fieldName}`);
  return value;
};

export const normalizeNullableString = (value) => value?.trim() || null;

export const parsePagination = ({ page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
};

export const applyDateRange = (target, { from, to }, fieldName = "createdAt") => {
  if (!from && !to) return;

  target[fieldName] = {};
  if (from) target[fieldName].$gte = new Date(from);
  if (to) target[fieldName].$lte = new Date(to);
};
