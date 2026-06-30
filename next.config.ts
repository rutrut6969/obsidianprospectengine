import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/leads/export": ["./src/assets/fonts/NotoSans-Regular.ttf"],
  },
};

export default nextConfig;
