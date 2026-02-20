import "dotenv/config";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { scheduleOverdueJob } from "./jobs/overdueInvoices.js";

const PORT = process.env.PORT ?? 4000;

connectDB()
  .then(() => {
    scheduleOverdueJob();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
