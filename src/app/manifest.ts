import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Evidence Locker",
    short_name: "Evidence Locker",
    description:
      "Record, organise and timestamp evidence for a goods or vehicle dispute. Information, not advice.",
    start_url: "/cases",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#1f4e79",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
