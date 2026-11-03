import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const turbopackRoot = fs.existsSync(path.join(__dirname, "node_modules", "next", "package.json"))
  ? __dirname
  : path.resolve(__dirname, "..");

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
  // Vercel installs from rrliRev, while this local workspace currently hoists
  // dependencies one directory up. Turbopack needs the dependency directory
  // inside its root, so choose the narrowest root that contains both.
  cleanDistDir: false,
  distDir,
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
