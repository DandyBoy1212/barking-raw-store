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

  /**
   * The four pillar pages are gone (spec section 3.4). Permanent, which Next
   * serves as a 308 and which preserves the request method. Good Food and Fun
   * and Games have honest successor shelves; Comfy Walks and Cosy Sleep have
   * none, so they go to the shop rather than to a category that would
   * misrepresent what the visitor clicked.
   */
  async redirects() {
    return [
      { source: "/good-food", destination: "/shop/treats", permanent: true },
      { source: "/comfy-walks", destination: "/shop", permanent: true },
      { source: "/fun-and-games", destination: "/shop/toys", permanent: true },
      { source: "/cosy-sleep", destination: "/shop", permanent: true },
    ];
  },
};

export default nextConfig;
