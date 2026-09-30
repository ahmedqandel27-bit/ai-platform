import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { syncModels, watchModels } from "./scripts/sync-models.mjs";

// Keep the model barrel in sync with generation/catalog/models/* (never hand-edit
// generation/catalog/models.generated.ts). New model files are picked up in dev.
syncModels();
if (process.env.NODE_ENV === "development") watchModels();

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Agent turns send the whole Super Computer conversation (Vercel caps bodies at 4.5 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default withNextIntl(nextConfig);
