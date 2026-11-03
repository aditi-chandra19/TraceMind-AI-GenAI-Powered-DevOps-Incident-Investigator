import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { authenticate, demoModeEnabled, registerUser, revokeSession, signIn } from "../services/auth.js";
import { databaseReady, memoryUsers } from "../services/memoryStore.js";
import { writeAuditLog } from "../services/audit.js";
import { UserModel } from "../models/User.js";
import bcrypt from "bcryptjs";

export const authRouter = Router();
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api", maxAge: 8 * 60 * 60 * 1000 };
const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } });
const registerLimit = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many account registrations. Try again later." } });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) });
const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be no more than 72 bytes") });

authRouter.post("/login", loginLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid sign-in details", details: parsed.error.flatten() });
  try {
    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result) return res.status(401).json({ error: "Email or password is incorrect" });
    res.cookie("tracemind_session", result.token, cookieOptions);
    await writeAuditLog({ actorId: result.user.id, actorEmail: result.user.email, action: "auth.login", resourceType: "session" });
    return res.json({ data: { user: result.user }, mode: databaseReady() ? "mongodb" : "demo" });
  } catch (error) { return next(error); }
});

authRouter.post("/register", registerLimit, async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid registration details", details: parsed.error.flatten() });
  if (!databaseReady() && !demoModeEnabled()) return res.status(503).json({ error: "Registration requires a connected database" });
  try {
    const user = await registerUser(parsed.data.name, parsed.data.email, parsed.data.password);
    const token = await signIn(user);
    res.cookie("tracemind_session", token, cookieOptions);
    await writeAuditLog({ actorId: user.id, actorEmail: user.email, action: "auth.register", resourceType: "user", resourceId: user.id });
    return res.status(201).json({ data: { user }, mode: databaseReady() ? "mongodb" : "demo" });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    if (duplicate) return res.status(409).json({ error: "An account with this email already exists" });
    if (error instanceof Error && error.message.includes("already exists")) return res.status(409).json({ error: error.message });
    return next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => res.json({ data: req.principal, mode: databaseReady() ? "mongodb" : "demo" }));
authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await revokeSession(req.sessionToken ?? "");
    await writeAuditLog({ actorId: req.principal!.id, actorEmail: req.principal!.email, action: "auth.logout", resourceType: "session" });
    res.clearCookie("tracemind_session", cookieOptions);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

authRouter.get("/users", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    if (databaseReady()) {
      const users = await UserModel.find().select("name email role disabled createdAt").sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ data: users });
    }
    const users = [{ id: "demo-admin", name: "TraceMind Demo Admin", email: (process.env.DEMO_ADMIN_EMAIL ?? "admin@tracemind.local").trim().toLowerCase(), role: "admin", disabled: false }, ...[...memoryUsers.values()].filter((user) => user.id !== "demo-admin").map(({ passwordHash: _passwordHash, ...user }) => user)];
    return res.json({ data: users });
  } catch (error) { return next(error); }
});

authRouter.post("/users", requireAuth, requireRole("admin"), async (req, res, next) => {
  const schema = registerSchema.extend({ role: z.enum(["admin", "analyst", "viewer"]).default("analyst") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid user details", details: parsed.error.flatten() });
  try {
    const { name, email, password, role } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    if (databaseReady()) {
      const user = await UserModel.create({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role });
      await writeAuditLog({ actorId: req.principal!.id, actorEmail: req.principal!.email, action: "user.create", resourceType: "user", resourceId: String(user._id), details: { role } });
      return res.status(201).json({ data: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
    }
    if ([...memoryUsers.values()].some((user) => user.email === normalizedEmail)) return res.status(409).json({ error: "An account with this email already exists" });
    const user = { id: `demo-${randomUUID()}`, name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role, disabled: false };
    memoryUsers.set(user.id, user);
    await writeAuditLog({ actorId: req.principal!.id, actorEmail: req.principal!.email, action: "user.create", resourceType: "user", resourceId: user.id, details: { role } });
    return res.status(201).json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    if (duplicate) return res.status(409).json({ error: "An account with this email already exists" });
    return next(error);
  }
});
