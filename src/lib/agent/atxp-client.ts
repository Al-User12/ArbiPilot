import "server-only";

import OpenAI from "openai";

import { getAtxpEnv } from "@/lib/config/env";

let cachedClient: OpenAI | null = null;

function toAtxpXApiKey(rawCredential: string) {
  try {
    const parsed = new URL(rawCredential);
    const connectionToken = parsed.searchParams.get("connection_token");

    if (connectionToken && connectionToken.length > 0) {
      return connectionToken;
    }
  } catch {
    // Not a URL credential; fallback to raw value.
  }

  return rawCredential;
}

export function getAtxpOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const atxp = getAtxpEnv();
  const xApiKey = toAtxpXApiKey(atxp.ATXP_API_KEY);

  cachedClient = new OpenAI({
    apiKey: atxp.ATXP_API_KEY,
    baseURL: atxp.OPENAI_BASE_URL,
    defaultHeaders: {
      "x-api-key": xApiKey,
    },
    timeout: 20_000,
  });

  return cachedClient;
}

export function getAtxpRuntimeConfig() {
  const atxp = getAtxpEnv();

  return {
    baseUrl: atxp.OPENAI_BASE_URL,
    model: atxp.OPENAI_MODEL,
  };
}
