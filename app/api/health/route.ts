export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    service: "alicia-ai",
    ts: new Date().toISOString(),
  });
}
