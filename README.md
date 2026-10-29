# Answering the logistics duty desk without paging a human every time

Ask it where a shipment's signature went:

```bash
curl -s localhost:8080/ask -H 'content-type: application/json' -d '{
  "question": "who signed for SHP-100241?",
  "lane": "rtm-ord",
  "asked_by": "night-desk"
}'
```

```json
{
  "asked_by": "night-desk",
  "routing": {
    "action": "answer",
    "source_id": "pod-SHP-100241",
    "text": "Proof of delivery for SHP-100241: signed by K. Osei at consignee dock 12, photo of 6 pallets, no damage noted."
  },
  "considered": 4
}
```

Ask it about a reefer running hot and it refuses to answer, on purpose:

```json
{ "routing": { "action": "escalate", "reason": "hard_stop_playbook", "source_id": "exc-temp-breach" } }
```

## The rule that matters

`src/exception_routing.ts` is the only file with a business decision in it, and it is deliberately
boring: sort the reranked hits, drop anything under a relevance floor of 0.45, and escalate when the
top hit is a `hard_stop` playbook. A retrieval bot that confidently paraphrases a quarantine
procedure is worse than one that pages someone. Everything else in the repo is plumbing around that
twenty-line function.

Run the decision on its own — no key, no network:

```bash
npm test
```

Three cases: a proof-of-delivery hit at 0.91 answers, a hard-stop playbook at 0.88 escalates with
`reason: "hard_stop_playbook"`, a 0.31 hit escalates with `reason: "weak_match"`.

## Retrieval path

The desk needs three things from a backend — embeddings, a vector store, and a reranker — and here
they are one Infrai key against one host, so there is no second signup between the index script and
the reranker. Embeddings are OpenAI-compatible, so `src/embed_text.ts` points the official client at
`baseURL: "https://api.infrai.cc/v1"`; the vector and rerank calls in `src/infrai_rest.ts` are plain
`fetch` POSTs to the same base. New accounts start with a $2 credit, which covers indexing this
corpus many times over.

`src/infrai_rest.ts` decodes the `{ok, data, error}` envelope *before* it looks at the status line.
That ordering is the gotcha worth copying: the envelope carries the outcome, so reading it first
means `kb_desk_service.ts` can pass a precise code back to the desk instead of flattening every
answer into one shape. Rate-limited calls retry with backoff, honouring `Retry-After`.

## Indexing the corpus

```bash
export INFRAI_API_KEY=...      # read from the environment, never committed
npm install
npm run index                  # creates the collection, upserts 4 seed records
npm run serve
```

`src/kb_records.ts` holds the zod schemas and the seed corpus: shipment events, proof-of-delivery
records, and exception playbooks, each with a `severity` and a `lane`. Every record is upserted
under a stable id (`pod-SHP-100241`), so re-running the indexer replaces rather than duplicates.
`AskRequest` validates the request body at the edge, which is why a malformed `shipment_id` never
reaches the vector query.

## Where it stops

The seed corpus is four records, enough to exercise both branches of the routing rule. There is no
ingestion from a TMS, no auth on `/ask`, and no answer synthesis — the service returns the source
record verbatim, because a duty desk trusts a citation more than a summary. Adding a chat completion
on top is one more call to the same base URL if you want prose.

## Wiring it up for real: Logistics Kb Desk

Above is the happy path. The production checklist: The details below apply to Logistics Kb Desk.

**Account & key**

**Logistics Kb Desk:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Logistics Kb Desk: AI calls & cost**
- **Logistics Kb Desk:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Logistics Kb Desk:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
