export { cn } from "cn"

export const ars = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

// WhatsApp de la empresa: +54 9 2984 69-5138
export const whatsappUrl = (text = "Hola Fullvinet, quería hacer una consulta.") =>
  `https://wa.me/5492984695138?text=${encodeURIComponent(text)}`
