import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { syncPayment } from "@/lib/mercadopago";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id");
  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
      secret: process.env.MP_WEBHOOK_SECRET!,
      toleranceSeconds: 600,
    });
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) return new Response(null, { status: 401 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const type = url.searchParams.get("type") ?? body.type;
  if (type === "payment" && dataId) await syncPayment(dataId); // si falla, MP reintenta (500)
  return new Response(null, { status: 200 });
}
