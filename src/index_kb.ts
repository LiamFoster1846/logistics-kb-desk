import { post } from "./infrai_rest.ts";
import { embedText, EMBED_DIMENSION } from "./embed_text.ts";
import { COLLECTION, SEED_RECORDS } from "./kb_records.ts";

/** Create the collection once, then upsert every record under its own stable id so a rerun re-applies cleanly. */
async function main() {
  await post("/vector/collection/create", {
    collection: COLLECTION,
    dimension: EMBED_DIMENSION,
    metric: "cosine",
    metadata: { owner: "duty-desk", contents: "shipment events, proof of delivery, exception playbooks" },
  });

  const embeddings = await embedText(SEED_RECORDS.map((r) => r.text));
  const vectors = SEED_RECORDS.map((record, i) => ({
    id: record.id,
    embedding: embeddings[i],
    metadata: {
      kind: record.kind,
      shipment_id: record.shipment_id,
      lane: record.lane,
      severity: record.severity,
      text: record.text,
    },
  }));

  await post("/vector/upsert", { collection: COLLECTION, vectors });
  console.log(`indexed ${vectors.length} records into ${COLLECTION}`);
}

await main();
