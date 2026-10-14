import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url))
  },
  poweredByHeader: false
};

export default nextConfig;
