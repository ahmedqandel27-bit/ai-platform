import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/** Lets the team "Add to Home Screen" and open the studio like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Viral Empire",
    description: APP_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#050309",
    theme_color: "#050309",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
