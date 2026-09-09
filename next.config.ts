import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared engine for the Bid product family, consumed as raw TS source
  // (see @netacracy/bid-core's README) -- Next doesn't transpile
  // node_modules by default, so this package needs to opt in explicitly.
  transpilePackages: ["@netacracy/bid-core"],
};

export default nextConfig;
