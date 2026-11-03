import "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
let server: ReturnType<typeof app.listen>;
if (process.env.MONGODB_URI) {
  try { await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 }); console.info("MongoDB connected"); }
  catch (error) { console.warn("MongoDB unavailable; starting in demo mode", error instanceof Error ? error.message : "connection error"); }
}
server = app.listen(port, () => console.info(`TraceMind API listening on http://localhost:${port}`));
const shutdown = async () => { server.close(); await mongoose.disconnect().catch(() => undefined); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
