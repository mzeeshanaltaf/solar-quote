import { ImageResponse } from "next/og";

// Branded social-share card. Declared `summary_large_image` previously had no
// image, so shared links rendered as bare text. Generated at build time (no
// request-time APIs) and reused for Twitter via app/twitter-image.tsx.
//
// Colors are hex approximations of the OKLCH "sunlight" tokens in globals.css —
// Satori (the next/og engine) does not render oklch(). Uses the default system
// font so the build never depends on fetching a font binary.

export const alt =
  "SolarQuote — your bill already knows if solar is worth it. A free solar savings estimate from your electricity bill.";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#faf7f0";
const INK = "#33291d";
const MUTED = "#6f6353";
const AMBER = "#b8692b";
const ACCENT = "#f0e6d4";
const BORDER = "#e7ddc9";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: PAPER,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Sun motif, top-right */}
        <div
          style={{
            position: "absolute",
            top: -140,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            backgroundColor: ACCENT,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -20,
            width: 200,
            height: 200,
            borderRadius: "50%",
            backgroundColor: AMBER,
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              backgroundColor: AMBER,
              display: "flex",
            }}
          />
          <span style={{ fontSize: 34, fontWeight: 700, color: INK }}>
            SolarQuote
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 880 }}>
          <span
            style={{
              fontSize: 74,
              lineHeight: 1.05,
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.015em",
            }}
          >
            Your bill already knows if solar is worth it.
          </span>
          <span style={{ marginTop: 28, fontSize: 30, color: MUTED, maxWidth: 760 }}>
            Upload your electricity bill for a free estimate — system size,
            savings in your own currency, and payback time.
          </span>
        </div>

        {/* Footer band */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            paddingTop: 28,
            borderTop: `2px solid ${BORDER}`,
          }}
        >
          <span
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              backgroundColor: AMBER,
              color: PAPER,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            Free · No sign-up
          </span>
          <span style={{ fontSize: 24, color: MUTED }}>
            Any utility, any language, anywhere the sun shines
          </span>
        </div>
      </div>
    ),
    size
  );
}
