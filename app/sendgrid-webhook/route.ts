import { NextResponse } from "next/server";

/**
 * SendGrid Event Webhook sink.
 *
 * Accept-and-discard, exactly what legacy did — its handler was
 * `console.log(req); res.sendStatus(200)` and nothing read the events. The one
 * behavioural fix: legacy registered this under `app.get('*')`, so SendGrid's
 * actual POSTs got a 404 and only GETs returned 200. Both are accepted here.
 *
 * Do not start processing these events without first verifying
 * X-Twilio-Email-Event-Webhook-Signature. The payload is ECDSA-signed precisely
 * because an unauthenticated endpoint that acts on "this address bounced" is a
 * way to have someone else's mail turned off.
 */
export const dynamic = "force-dynamic";

function acknowledge(request: Request): NextResponse {
  console.info(
    JSON.stringify({
      event: "sendgrid-webhook",
      method: request.method,
      contentLength: request.headers.get("content-length"),
      ua: request.headers.get("user-agent"),
      signed: request.headers.has(
        "x-twilio-email-event-webhook-signature",
      ),
    }),
  );
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: Request) {
  return acknowledge(request);
}

export async function POST(request: Request) {
  return acknowledge(request);
}
