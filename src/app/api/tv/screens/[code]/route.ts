import { handleScreenRequest } from "@/tv/server/handler";

export async function GET(request: Request, ctx: RouteContext<"/api/tv/screens/[code]">) {
  const { code } = await ctx.params;
  return handleScreenRequest(request, code);
}

export async function POST(request: Request, ctx: RouteContext<"/api/tv/screens/[code]">) {
  const { code } = await ctx.params;
  return handleScreenRequest(request, code);
}
