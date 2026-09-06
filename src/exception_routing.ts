export type Hit = {
  id: string;
  kind: "shipment_event" | "pod" | "exception_playbook";
  severity: "info" | "watch" | "hard_stop";
  text: string;
  relevance: number;
};

export type Routing =
  | { action: "answer"; source_id: string; text: string }
  | { action: "escalate"; reason: "hard_stop_playbook" | "weak_match"; source_id: string | null };

export const MIN_RELEVANCE = 0.45;

/**
 * The one decision this service owns: answer from the knowledge base, or wake the duty desk.
 * A hard-stop playbook always escalates even when the match is strong — that is the whole point of it.
 */
export function routeAnswer(hits: Hit[]): Routing {
  const ranked = [...hits].sort((a, b) => b.relevance - a.relevance);
  const best = ranked[0];
  if (!best || best.relevance < MIN_RELEVANCE) {
    return { action: "escalate", reason: "weak_match", source_id: best?.id ?? null };
  }
  if (best.kind === "exception_playbook" && best.severity === "hard_stop") {
    return { action: "escalate", reason: "hard_stop_playbook", source_id: best.id };
  }
  return { action: "answer", source_id: best.id, text: best.text };
}
