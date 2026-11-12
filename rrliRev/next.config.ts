import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const turbopackRoot = __dirname;

if (process.argv.includes("build")) {
  try {
    const absDist = path.join(__dirname, distDir);
    const appRoutes = [
      "_global-error",
      "_not-found",
      "login",
      "dashboard",
      "deliveries",
      "deliveries/new",
      "deliveries/import",
      "truck-profitability",
      "truck-profitability/[plate]",
      "pod-documents",
      "reports",
      "user-management",
      "settings",
      "api/auth",
      "api/auth/login",
      "api/auth/logout",
      "api/auth/forgot-password",
      "api/auth/me",
      "api/deliveries",
      "api/deliveries/documents",
      "api/deliveries/import",
      "api/deliveries/summary",
      "api/users",
    ];
    for (const route of appRoutes) {
      fs.mkdirSync(path.join(absDist, "server/app", route), { recursive: true });
      fs.mkdirSync(path.join(absDist, "static/chunks/app", route), { recursive: true });
      fs.mkdirSync(path.join(absDist, "types/app", route), { recursive: true });
      const leaf = route.split("/").pop() ?? route;
      fs.mkdirSync(path.join(absDist, "server/app", `${route}.segments`, leaf), {
        recursive: true,
      });
    }
  } catch {
    // Ignore pre-creation warnings if directory is managed externally
  }
}

const nextConfig: NextConfig = {
  cleanDistDir: false,
  distDir,
  env: {
    ROUTEX_SESSION_SECRET:
      process.env.ROUTEX_SESSION_SECRET ||
      "routex-production-session-fallback-secret-2026-auth",
  },
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
