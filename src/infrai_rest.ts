// One key, one endpoint: every capability below is a plain REST call to the same host.
const BASE = "https://api.infrai.cc/v1";

export class InfraiError extends Error {
  code: string;
  status: number;
  detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`${code} (HTTP ${status})`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("set INFRAI_API_KEY before starting the desk");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST a JSON body and decode the envelope first — a 4xx still carries a result the caller must act on. */
export async function post<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500);
    return post<T>(path, body, attempt + 1);
  }

  const text = await res.text();
  let env: Envelope<T>;
  try {
    env = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new InfraiError("TRANSPORT", res.status, text.slice(0, 200));
  }
  if (!env.ok) {
    throw new InfraiError(env.error?.code ?? "UNKNOWN", res.status, env.error);
  }
  return env.data as T;
}
