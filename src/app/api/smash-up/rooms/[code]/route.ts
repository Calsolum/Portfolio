import { handleRoomRequest } from "@/smashup/server/handler";

export async function GET(request: Request, ctx: RouteContext<"/api/smash-up/rooms/[code]">) {
  const { code } = await ctx.params;
  return handleRoomRequest(request, code);
}

export async function POST(request: Request, ctx: RouteContext<"/api/smash-up/rooms/[code]">) {
  const { code } = await ctx.params;
  return handleRoomRequest(request, code);
}
