import { TV_PAGE } from "@/tv/page";

// A plain page rather than a React one, so the old browsers on a TV box can run it.
export function GET() {
  return new Response(TV_PAGE, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
