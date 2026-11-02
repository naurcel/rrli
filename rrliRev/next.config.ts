import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";

if (process.argv.includes("build")) {
  try {
    const absDist = path.join(__dirname, distDir);
    fs.rmSync(path.join(absDist, "types"), { recursive: true, force: true });
    const appRoutes = [
      "_global-error",
      "_not-found",
      "login",
      "dashboard",
      "deliveries",
      "deliveries/new",
      "deliveries/import",
      "truck-profitability",
      "pod-documents",
      "reports",
      "user-management",
      "settings",
      "api/auth/login",
      "api/auth/logout",
      "api/auth/forgot-password",
      "api/auth/me",
      "api/deliveries",
      "api/users",
    ];
    for (const route of appRoutes) {
      fs.mkdirSync(path.join(absDist, "server/app", route), { recursive: true });
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
  // rrliRev is intentionally nested inside the existing RouteX repository.
  // Keep Turbopack from traversing to the parent application's proxy/routes.
  cleanDistDir: false,
  distDir,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
