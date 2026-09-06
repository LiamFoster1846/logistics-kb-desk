import test from "node:test";
import assert from "node:assert/strict";
import { routeAnswer, type Hit } from "../src/exception_routing.ts";

const podHit: Hit = {
  id: "pod-SHP-100241",
  kind: "pod",
  severity: "info",
  text: "Proof of delivery for SHP-100241: signed by K. Osei at dock 12.",
  relevance: 0.91,
};

const hardStop: Hit = {
  id: "exc-temp-breach",
  kind: "exception_playbook",
  severity: "hard_stop",
  text: "Reefer temperature breach: quarantine the pallets and page the duty desk.",
  relevance: 0.88,
};

test("a strong proof-of-delivery match is answered from the knowledge base", () => {
  const routing = routeAnswer([podHit, { ...hardStop, relevance: 0.2 }]);
  assert.equal(routing.action, "answer");
  assert.equal(routing.source_id, "pod-SHP-100241");
});

test("a hard-stop playbook escalates even when it is the best match", () => {
  const routing = routeAnswer([hardStop, { ...podHit, relevance: 0.5 }]);
  assert.deepEqual(routing, { action: "escalate", reason: "hard_stop_playbook", source_id: "exc-temp-breach" });
});

test("everything below the relevance floor goes to a human", () => {
  const routing = routeAnswer([{ ...podHit, relevance: 0.31 }]);
  assert.equal(routing.action, "escalate");
  assert.equal(routing.action === "escalate" && routing.reason, "weak_match");
});
