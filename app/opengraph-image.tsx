import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { BAT_PATH, BAT_VIEWBOX } from "@/components/brand/bat";

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview (WhatsApp, Telegram, LinkedIn, X…): the logo lockup on black. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 72,
          padding: "0 96px",
          background: "#050309",
          backgroundImage: "radial-gradient(circle at 25% 50%, rgba(106,0,244,0.35), transparent 45%)",
          color: "#f5edff",
        }}
      >
        <div
          style={{
            width: 380,
            height: 380,
            flexShrink: 0,
            borderRadius: 999,
            border: "3px solid #9018f0",
            boxShadow: "0 0 40px #6a0cf0, inset 0 0 30px rgba(144,24,240,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="290" height="137" viewBox={BAT_VIEWBOX}>
            <path d={BAT_PATH} fill="#8a2bff" fillRule="evenodd" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, letterSpacing: 2, lineHeight: 1 }}>
            <span>THE&nbsp;</span>
            <span style={{ color: "#a43bff" }}>VIRAL</span>
          </div>
          <div style={{ fontSize: 34, letterSpacing: 22, marginTop: 18, color: "#e9e0f5" }}>EMPIRE</div>
          <div style={{ fontSize: 26, marginTop: 48, color: "#9a90a8" }}>{APP_TAGLINE}</div>
        </div>
      </div>
    ),
    size,
  );
}
