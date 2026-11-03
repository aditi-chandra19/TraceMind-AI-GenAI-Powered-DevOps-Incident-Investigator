import type { NextFunction, Request, Response } from "express";
import { principalFromToken, type Principal, type UserRole } from "../services/auth.js";

declare global { namespace Express { interface Request { principal?: Principal; sessionToken?: string } } }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : req.cookies?.tracemind_session;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const principal = await principalFromToken(token);
  if (!principal) return res.status(401).json({ error: "Invalid or expired session" });
  req.principal = principal;
  req.sessionToken = token;
  return next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.principal) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.principal.role)) return res.status(403).json({ error: "Insufficient role for this action" });
    return next();
  };
}
