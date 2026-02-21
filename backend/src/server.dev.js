/**
 * Development entry point — spins up an in-memory MongoDB instance so you
 * don't need a local mongod or Atlas cluster during development.
 * Data is lost on every restart (that's intentional for dev/testing).
 */
import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import app from "./app.js";
import { scheduleOverdueJob } from "./jobs/overdueInvoices.js";

const PORT = process.env.PORT ?? 4000;

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();

await mongoose.connect(uri);
console.log("MongoDB in-memory connected:", uri);

scheduleOverdueJob();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}  [DEV — in-memory DB]`);
});

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
});
