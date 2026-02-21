/**
 * Standalone smoke test for POST /auth/register and POST /auth/login.
 * Uses mongodb-memory-server so no real MongoDB installation is needed.
 *
 * Run: node test-register.js
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// ── boot in-memory MongoDB first, then set env ────────────────────────────────
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_ACCESS_SECRET = "test_access_secret_32_characters!!";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_32_characters!!";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "7d";
process.env.PORT = "4099";
process.env.CLIENT_ORIGIN = "http://localhost:5173";

// ── import app after env is set ───────────────────────────────────────────────
import { connectDB } from "./src/config/db.js";
import app from "./src/app.js";

await connectDB();
const server = app.listen(4099);

// ── helpers ───────────────────────────────────────────────────────────────────
const BASE = "http://localhost:4099";

async function req(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, headers: res.headers };
}

let passed = 0;
let failed = 0;

function check(name, condition, got) {
  if (condition) {
    console.log(`  ✓  ${name}`);
    passed++;
  } else {
    console.error(`  ✗  ${name}`, got !== undefined ? `→ got: ${JSON.stringify(got)}` : "");
    failed++;
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

console.log("\n── Health check ─────────────────────────────────────────────");
const health = await req("GET", "/health");
check("GET /health returns 200", health.status === 200, health.status);
check("status: ok", health.body.status === "ok", health.body);

console.log("\n── POST /auth/register ──────────────────────────────────────");
const reg = await req("POST", "/auth/register", {
  clinicName: "Clínica Test",
  clinicEmail: "clinica@test.com",
  name: "Dr. Test",
  email: "admin@test.com",
  password: "password123",
});
check("status 201", reg.status === 201, reg.status);
check("accessToken present", typeof reg.body.accessToken === "string", reg.body);
check("user.role = clinic_admin", reg.body.user?.role === "clinic_admin", reg.body.user);
check("user.email matches", reg.body.user?.email === "admin@test.com", reg.body.user);
check("no passwordHash exposed", reg.body.user?.passwordHash === undefined, reg.body.user);

const accessToken = reg.body.accessToken;

console.log("\n── POST /auth/register (duplicate email) ────────────────────");
const dup = await req("POST", "/auth/register", {
  clinicName: "Otra Clínica",
  clinicEmail: "otra@test.com",
  name: "Otro",
  email: "admin@test.com",   // same email
  password: "password123",
});
check("status 409 on duplicate", dup.status === 409, dup.status);

console.log("\n── POST /auth/login ─────────────────────────────────────────");
const login = await req("POST", "/auth/login", {
  email: "admin@test.com",
  password: "password123",
});
check("status 200", login.status === 200, login.status);
check("accessToken present", typeof login.body.accessToken === "string", login.body);

console.log("\n── POST /auth/login (wrong password) ────────────────────────");
const badLogin = await req("POST", "/auth/login", {
  email: "admin@test.com",
  password: "wrong",
});
check("status 401", badLogin.status === 401, badLogin.status);

console.log("\n── GET /auth/me ─────────────────────────────────────────────");
const me = await req("GET", "/auth/me", null, {
  Authorization: `Bearer ${accessToken}`,
});
check("status 200", me.status === 200, me.status);
check("returns user", me.body.user?.email === "admin@test.com", me.body);

console.log("\n── GET /auth/me (no token) ──────────────────────────────────");
const meNoAuth = await req("GET", "/auth/me");
check("status 401", meNoAuth.status === 401, meNoAuth.status);

console.log("\n── POST /auth/logout ────────────────────────────────────────");
const logout = await req("POST", "/auth/logout");
check("status 200", logout.status === 200, logout.status);

// ── results ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(52)}`);
console.log(`  ${passed} passed  |  ${failed} failed\n`);

server.close();
await mongoose.disconnect();
await mongod.stop();

process.exit(failed > 0 ? 1 : 0);
