import type { MetadataRoute } from "next";

// Solo el login es público; el panel de admin no se indexa
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin"] },
    sitemap: "https://fullvinet.vercel.app/sitemap.xml",
  };
}
