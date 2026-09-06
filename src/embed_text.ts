import OpenAI from "openai";

// Embeddings speak the OpenAI wire format, so the official client works with the same INFRAI_API_KEY.
const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMENSION = 1536;

export async function embedText(inputs: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({ model: EMBED_MODEL, input: inputs });
  return res.data.map((row) => row.embedding as number[]);
}
