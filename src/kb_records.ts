import { z } from "zod";

export const COLLECTION = "logistics-kb";

/** Three record kinds the duty desk actually files: movement, proof of delivery, exception playbook. */
export const KbRecord = z.object({
  id: z.string().min(1),
  kind: z.enum(["shipment_event", "pod", "exception_playbook"]),
  shipment_id: z.string().regex(/^SHP-\d{6}$/),
  lane: z.string().min(2),
  text: z.string().min(10),
  severity: z.enum(["info", "watch", "hard_stop"]).default("info"),
});
export type KbRecord = z.infer<typeof KbRecord>;

export const AskRequest = z.object({
  question: z.string().min(5).max(500),
  lane: z.string().min(2).optional(),
  asked_by: z.string().min(1),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const SEED_RECORDS: KbRecord[] = KbRecord.array().parse([
  {
    id: "evt-SHP-100241-arrive",
    kind: "shipment_event",
    shipment_id: "SHP-100241",
    lane: "rtm-ord",
    text: "SHP-100241 arrived at ORD cross-dock 04:12Z, 6 pallets scanned, seal intact, released to floor at 05:40Z.",
    severity: "info",
  },
  {
    id: "pod-SHP-100241",
    kind: "pod",
    shipment_id: "SHP-100241",
    lane: "rtm-ord",
    text: "Proof of delivery for SHP-100241: signed by K. Osei at consignee dock 12, photo of 6 pallets, no damage noted.",
    severity: "info",
  },
  {
    id: "exc-temp-breach",
    kind: "exception_playbook",
    shipment_id: "SHP-100377",
    lane: "rtm-ord",
    text: "Reefer temperature breach above 8C for more than 30 minutes: quarantine the pallets, page the duty desk, do not release to the consignee until quality signs off.",
    severity: "hard_stop",
  },
  {
    id: "exc-missing-pod",
    kind: "exception_playbook",
    shipment_id: "SHP-100412",
    lane: "any",
    text: "Delivery scanned but no signature captured: re-request the signature from the driver app within 24 hours, then file a delivery attestation.",
    severity: "watch",
  },
]);
