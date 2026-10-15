import type { MetadataRoute } from "next";

// Solo el login es público; las vistas de cliente y admin no se indexan
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/api/"] },
    sitemap: "https://fullvinet.vercel.app/sitemap.xml",
  };
}
