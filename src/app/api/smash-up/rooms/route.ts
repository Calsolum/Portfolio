import { handleRoomsRequest } from "@/smashup/server/handler";

export function GET(request: Request) {
  return handleRoomsRequest(request);
}

export function POST(request: Request) {
  return handleRoomsRequest(request);
}
