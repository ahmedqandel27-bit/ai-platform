import { ImageResponse } from "next/og";
import { BAT_PATH, BAT_VIEWBOX } from "@/components/brand/bat";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon (iOS/Android): the bat in the neon ring, on black. */
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
          background: "radial-gradient(circle at 50% 45%, #1a0638, #050309 70%)",
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 999,
            border: "3px solid #9018f0",
            boxShadow: "0 0 18px #6a0cf0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="112" height="53" viewBox={BAT_VIEWBOX}>
            <path d={BAT_PATH} fill="#9d3bff" fillRule="evenodd" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
