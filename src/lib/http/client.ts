import { ZodSchema } from "zod";

import { ApiErrorResponseSchema } from "@/lib/agent/schema";

export async function readJsonOrThrow<T>(
  response: Response,
  successSchema: ZodSchema<T>,
): Promise<T> {
  const raw = await response.json();

  if (!response.ok) {
    const parsedError = ApiErrorResponseSchema.safeParse(raw);

    if (parsedError.success) {
      throw new Error(`${parsedError.data.error.code}: ${parsedError.data.error.message}`);
    }

    throw new Error("Request failed with an unrecognized error payload.");
  }

  const parsed = successSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Server returned an invalid response shape.");
  }

  return parsed.data;
}
