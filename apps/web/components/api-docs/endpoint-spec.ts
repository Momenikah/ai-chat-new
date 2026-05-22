export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
export const PUBLIC_BASE = `${API_BASE}/public`;

export type Lang = "curl" | "js" | "python";

export const LANGS: { key: Lang; label: string }[] = [
  { key: "curl", label: "cURL" },
  { key: "js", label: "JavaScript" },
  { key: "python", label: "Python" },
];

export interface QueryParam {
  name: string;
  example: string;
  desc: string;
}

export interface EndpointSpec {
  id: string;
  method: "GET" | "POST";
  /** Path relative to API root, e.g. "/public/messages/send". */
  path: string;
  desc: string;
  /** Example JSON body for POST endpoints. */
  body?: Record<string, unknown>;
  /** Query params for GET endpoints. */
  query?: QueryParam[];
  /** A `:param` segment the caller must fill (e.g. conversation id). */
  pathParam?: { name: string; example: string };
  /** Example 200 response, pretty-printed. */
  response: string;
  /** Whether the Try-it console can safely run it (GET only). */
  tryable: boolean;
}

export const ENDPOINTS: EndpointSpec[] = [
  {
    id: "messages-send",
    method: "POST",
    path: "/public/messages/send",
    desc: "Kirim pesan teks. Balas thread (conversation_id) atau mulai baru (channel_id + to).",
    body: {
      channel_id: "<channel-uuid>",
      to: "6281234567890",
      body: "Halo dari API!",
    },
    response: `{
  "id": "msg_8f2c",
  "conversation_id": "conv_1a9",
  "direction": "outbound",
  "status": "queued",
  "body": "Halo dari API!",
  "created_at": "2026-05-22T03:14:00Z"
}`,
    tryable: false,
  },
  {
    id: "messages-template",
    method: "POST",
    path: "/public/messages/template",
    desc: "Kirim pesan dari template yang sudah approved, dengan variabel.",
    body: {
      channel_id: "<channel-uuid>",
      to: "6281234567890",
      template_id: "<template-uuid>",
      variables: { name: "Budi" },
    },
    response: `{
  "id": "msg_9d1e",
  "conversation_id": "conv_3b2",
  "direction": "outbound",
  "status": "queued",
  "created_at": "2026-05-22T03:15:10Z"
}`,
    tryable: false,
  },
  {
    id: "contacts-list",
    method: "GET",
    path: "/public/contacts",
    desc: "Daftar kontak workspace.",
    query: [
      { name: "search", example: "budi", desc: "Cari nama/telepon/email" },
      { name: "limit", example: "20", desc: "Maks hasil (default 50)" },
      { name: "offset", example: "0", desc: "Geser hasil untuk paginasi" },
    ],
    response: `{
  "contacts": [
    {
      "id": "ct_1",
      "name": "Budi Santoso",
      "phone": "6281234567890",
      "email": "budi@mail.com",
      "created_at": "2026-05-20T08:00:00Z"
    }
  ]
}`,
    tryable: true,
  },
  {
    id: "contacts-create",
    method: "POST",
    path: "/public/contacts",
    desc: "Buat kontak baru.",
    body: { name: "Budi", phone: "6281234567890", email: "budi@mail.com" },
    response: `{
  "id": "ct_2",
  "name": "Budi",
  "phone": "6281234567890",
  "email": "budi@mail.com",
  "created_at": "2026-05-22T03:16:00Z"
}`,
    tryable: false,
  },
  {
    id: "conversations-list",
    method: "GET",
    path: "/public/conversations",
    desc: "Daftar percakapan inbox workspace.",
    response: `{
  "conversations": [
    {
      "id": "conv_1a9",
      "contact_name": "Budi Santoso",
      "channel_type": "whatsapp",
      "status": "open",
      "last_message_at": "2026-05-22T03:10:00Z"
    }
  ]
}`,
    tryable: true,
  },
  {
    id: "conversation-messages",
    method: "GET",
    path: "/public/conversations/:id/messages",
    desc: "Daftar pesan dalam sebuah percakapan.",
    pathParam: { name: "id", example: "<conversation-uuid>" },
    response: `{
  "messages": [
    {
      "id": "msg_1",
      "direction": "inbound",
      "body": "Halo, masih buka?",
      "created_at": "2026-05-22T03:09:00Z"
    }
  ]
}`,
    tryable: true,
  },
];

/* --------------------------- URL building ------------------------------ */

function buildUrl(ep: EndpointSpec, opts: { withQuery?: boolean } = {}): string {
  let path = ep.path;
  if (ep.pathParam) {
    path = path.replace(`:${ep.pathParam.name}`, ep.pathParam.example);
  }
  let url = `${API_BASE}${path}`;
  if (opts.withQuery && ep.query && ep.query.length > 0) {
    const qs = ep.query
      .map((q) => `${q.name}=${encodeURIComponent(q.example)}`)
      .join("&");
    url += `?${qs}`;
  }
  return url;
}

/* --------------------------- Snippet builders -------------------------- */

export function snippet(ep: EndpointSpec, lang: Lang, key: string): string {
  const bearer = key.trim() || "aic_xxxxxxxxxxxx";
  switch (lang) {
    case "curl":
      return curlSnippet(ep, bearer);
    case "js":
      return jsSnippet(ep, bearer);
    case "python":
      return pythonSnippet(ep, bearer);
  }
}

function curlSnippet(ep: EndpointSpec, bearer: string): string {
  const url = buildUrl(ep, { withQuery: ep.method === "GET" });
  const lines = [`curl${ep.method === "GET" ? "" : " -X POST"} ${url} \\`];
  lines.push(`  -H "Authorization: Bearer ${bearer}"`);
  if (ep.body) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(ep.body, null, 2)}'`);
  }
  return lines.join("\n");
}

function jsSnippet(ep: EndpointSpec, bearer: string): string {
  const url = buildUrl(ep, { withQuery: ep.method === "GET" });
  const opts: string[] = [];
  if (ep.method === "POST") opts.push(`  method: "POST",`);
  const headers = [`    Authorization: "Bearer ${bearer}",`];
  if (ep.body) headers.push(`    "Content-Type": "application/json",`);
  opts.push(`  headers: {\n${headers.join("\n")}\n  },`);
  if (ep.body) {
    opts.push(`  body: JSON.stringify(${JSON.stringify(ep.body, null, 2)}),`);
  }
  return `const res = await fetch(
  "${url}",
  {
${opts.join("\n")}
  },
);
const data = await res.json();
console.log(data);`;
}

function pythonSnippet(ep: EndpointSpec, bearer: string): string {
  const url = buildUrl(ep, { withQuery: ep.method === "GET" });
  const headerLines = [`    "Authorization": "Bearer ${bearer}",`];
  if (ep.body) headerLines.push(`    "Content-Type": "application/json",`);
  const headers = `headers = {\n${headerLines.join("\n")}\n}`;
  if (ep.method === "GET") {
    return `import requests

${headers}
res = requests.get("${url}", headers=headers)
print(res.json())`;
  }
  const body = `payload = ${pyDict(ep.body ?? {})}`;
  return `import requests

${headers}
${body}
res = requests.post("${url}", headers=headers, json=payload)
print(res.json())`;
}

/** Render a JS object as a Python dict literal (good enough for examples). */
function pyDict(obj: Record<string, unknown>, indent = 0): string {
  const pad = "    ".repeat(indent + 1);
  const closePad = "    ".repeat(indent);
  const entries = Object.entries(obj).map(([k, v]) => {
    let val: string;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      val = pyDict(v as Record<string, unknown>, indent + 1);
    } else if (typeof v === "string") {
      val = `"${v}"`;
    } else {
      val = String(v);
    }
    return `${pad}"${k}": ${val},`;
  });
  return `{\n${entries.join("\n")}\n${closePad}}`;
}

export function tryUrl(
  ep: EndpointSpec,
  overrides: { pathParam?: string; query?: Record<string, string> },
): string {
  let path = ep.path;
  if (ep.pathParam) {
    const v = overrides.pathParam?.trim() || ep.pathParam.example;
    path = path.replace(`:${ep.pathParam.name}`, encodeURIComponent(v));
  }
  let url = `${API_BASE}${path}`;
  const q = overrides.query ?? {};
  const pairs = Object.entries(q).filter(([, v]) => v.trim() !== "");
  if (pairs.length > 0) {
    url +=
      "?" +
      pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }
  return url;
}
