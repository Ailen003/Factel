import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const bars = [14, 26, 38, 24, 46, 32, 18];

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 52%, #22d3ee 100%)",
        borderRadius: 16,
        display: "flex",
        gap: 3,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          style={{
            background: "#ffffff",
            borderRadius: 999,
            display: "block",
            height,
            opacity: 0.95,
            width: 4,
          }}
        />
      ))}
    </div>,
    size,
  );
}
