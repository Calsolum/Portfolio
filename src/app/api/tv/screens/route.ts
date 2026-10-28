import { handleScreensRequest } from "@/tv/server/handler";

export function POST(request: Request) {
  return handleScreensRequest(request);
}
