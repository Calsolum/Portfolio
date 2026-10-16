import { handleWebDealsRequest } from "@/deals/server/handler";

/**
 * A cold search can run for a couple of minutes while Claude searches and reads
 * pages. 300 seconds is the longest a Vercel function may run on the Hobby plan.
 */
export const maxDuration = 300;

export function GET(request: Request) {
  return handleWebDealsRequest(request);
}
