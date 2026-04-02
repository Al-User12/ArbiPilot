import "server-only";

import OpenAI from "openai";

import { getAtxpEnv } from "@/lib/config/env";

let cachedClient: OpenAI | null = null;

export function getAtxpOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const atxp = getAtxpEnv();

  cachedClient = new OpenAI({
    apiKey: atxp.ATXP_API_KEY,
    baseURL: atxp.OPENAI_BASE_URL,
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
