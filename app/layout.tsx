import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WhatsAppButton } from "@/components/whatsapp-button";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Fullvinet, proveedor de internet. Consultá el estado de tu servicio, tu plan y pagá tu factura online con Mercado Pago.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fullvinet.vercel.app"),
  title: { default: "Fullvinet · Internet", template: "%s · Fullvinet" },
  description,
  applicationName: "Fullvinet",
  keywords: ["Fullvinet", "internet", "proveedor de internet", "pagar factura de internet", "Mercado Pago"],
  alternates: { canonical: "/login" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Fullvinet",
    title: "Fullvinet · Internet",
    description,
    url: "/login",
  },
  twitter: { card: "summary_large_image", title: "Fullvinet · Internet", description },
};

export const viewport: Viewport = { themeColor: "#1f2328" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
