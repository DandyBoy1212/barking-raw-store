import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * firebase-admin is on Next's default server-external list, which means the
   * deployed function loads it with native require() from node_modules. Its
   * auth package requires jwks-rsa, which requires jose 6, which is ESM-only,
   * and on Vercel's runtime that chain died at function start with
   * ERR_REQUIRE_ESM: every route 500ed before any of our code ran. It worked
   * locally only because newer Node allows require() of ES modules.
   *
   * Bundling firebase-admin instead lets the bundler rewrite that require into
   * its own interop, which works on every Node version, here and on Vercel.
   */
  transpilePackages: ["firebase-admin"],
};

export default nextConfig;
