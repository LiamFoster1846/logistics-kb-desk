import { createServer } from "node:http";
import { post, InfraiError } from "./infrai_rest.ts";
import { embedText } from "./embed_text.ts";
import { AskRequest, COLLECTION } from "./kb_records.ts";
import { routeAnswer, type Hit } from "./exception_routing.ts";

type QueryMatch = { id: string; score: number; metadata?: Record<string, unknown> };

async function ask(body: unknown) {
  const req = AskRequest.parse(body);

  const [embedding] = await embedText([req.question]);
  const matches = await post<{ matches: QueryMatch[] }>("/vector/query", {
    collection: COLLECTION,
    embedding,
    top_k: 8,
    include_metadata: true,
    ...(req.lane ? { filter: { lane: req.lane } } : {}),
  });

  const candidates = matches.matches.map((m) => String(m.metadata?.text ?? ""));
  const reranked = await post<{ results: Array<{ index: number; score: number }> }>("/ai/rerank", {
    query: req.question,
    candidates,
    top_k: 4,
    model: "auto",
  });

  const hits: Hit[] = reranked.results.map((r) => {
    const match = matches.matches[r.index];
    return {
      id: match.id,
      kind: match.metadata?.kind as Hit["kind"],
      severity: (match.metadata?.severity as Hit["severity"]) ?? "info",
      text: String(match.metadata?.text ?? ""),
      relevance: r.score,
    };
  });

  return { asked_by: req.asked_by, routing: routeAnswer(hits), considered: hits.length };
}

const server = createServer((httpReq, res) => {
  const chunks: Buffer[] = [];
  httpReq.on("data", (c: Buffer) => chunks.push(c));
  httpReq.on("end", async () => {
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (httpReq.method !== "POST" || httpReq.url !== "/ask") return send(404, { error: "POST /ask" });
    try {
      send(200, await ask(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")));
    } catch (err) {
      // A rejected request stays a client error for our caller; only transport trouble becomes a 502.
      if (err instanceof InfraiError) return send(err.status < 500 ? err.status : 502, { error: err.code });
      send(400, { error: err instanceof Error ? err.message : "bad request" });
    }
  });
});

server.listen(Number(process.env.PORT ?? 8080), () => {
  console.log(`kb desk on :${process.env.PORT ?? 8080} — POST /ask`);
});
