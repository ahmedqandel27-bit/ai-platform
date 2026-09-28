import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon (iOS/Android): the monogram on the accent gradient. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #8b5cf6, #22d3ee)",
          color: "white",
          fontSize: 110,
          fontWeight: 600,
        }}
      >
        {APP_NAME.charAt(0)}
      </div>
    ),
    size,
  );
}
