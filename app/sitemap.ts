import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://fullvinet.vercel.app/login", changeFrequency: "monthly", priority: 1 }];
}
