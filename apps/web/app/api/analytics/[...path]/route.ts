import { NextRequest, NextResponse } from "next/server";

const ANALYTICS_SERVICE_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const query = searchParams ? `?${searchParams}` : "";

    const targetUrl = `${ANALYTICS_SERVICE_URL}/api/analytics/${subpath}${query}`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/pdf")) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            res.headers.get("content-disposition") ||
            'attachment; filename="report.pdf"',
        },
      });
    }

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Analytics proxy error";
    return NextResponse.json(
      { error: "Failed to connect to analytics microservice", detail: message },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const body = await request.json().catch(() => ({}));

    const targetUrl = `${ANALYTICS_SERVICE_URL}/api/analytics/${subpath}`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Analytics proxy error";
    return NextResponse.json(
      { error: "Failed to connect to analytics microservice", detail: message },
      { status: 502 }
    );
  }
}
