import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview (WhatsApp, Telegram, LinkedIn, X…). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#07070a",
          backgroundImage:
            "radial-gradient(circle at 85% 0%, rgba(139,92,246,0.35), transparent 55%), radial-gradient(circle at 0% 100%, rgba(34,211,238,0.18), transparent 50%)",
          color: "#ededf2",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #8b5cf6, #22d3ee)",
              fontSize: 38,
              fontWeight: 600,
              color: "white",
            }}
          >
            {APP_NAME.charAt(0)}
          </div>
          <div style={{ fontSize: 28, letterSpacing: 8 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 950 }}>{APP_TAGLINE}</div>
          <div style={{ fontSize: 28, color: "#8b8b99" }}>Image · Video · Super Computer</div>
        </div>
      </div>
    ),
    size,
  );
}
