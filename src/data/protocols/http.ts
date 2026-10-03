import { ACCENTS } from "../accents";
import type { ProtocolDefinition } from "../types";

export const http: ProtocolDefinition = {
  id: "http",
  name: "HTTP",
  longName: "HyperText Transfer Protocol",
  subtitle: "Request / response over a transport connection",
  layer: "Application Layer",
  layerId: "application",
  communication: "Request / Response",
  purpose: "Resource transfer between a client and a server",
  hook:
    "A text-shaped protocol for asking for things and getting them back — designed so that a browser and a server built decades apart can still agree.",
  intro:
    "HTTP is an application-layer protocol, which means it says nothing about how bytes reach the other machine. It defines only the shape of the conversation: a client sends a request naming a resource and a method, the server replies with a status code and a body. It is deliberately human-readable and stateless, and those two decisions are why it survived from the early web into an era of APIs, streaming and HTTP/3.",
  accent: ACCENTS.http,

  problem: {
    headline: "Two programs must agree on what 'get me that page' means",
    detail:
      "Before HTTP, every information system had its own commands and its own idea of what a resource was. To make a web of documents possible, there had to be one vocabulary: how to name a resource, how to say what you want done to it, how to describe what you got back, and how to extend all of it later without breaking existing clients. Just as hard: the conversation has to survive lossy links, so it must be built over something that solves delivery — but it must not depend on a specific transport, or it could never migrate.",
    failures: [
      "Every service would need its own bespoke request format, so nothing could interoperate",
      "Without a status vocabulary, errors, redirects and missing pages look identical",
      "Without explicit caching rules, every request has to go to the origin server",
      "Without extensible metadata, new features could only be added by breaking old clients",
      "Without content type negotiation, a client cannot know what it just received",
      "State is expensive to keep per user on a server with millions of users",
    ],
  },
  solution: {
    headline: "A small vocabulary, made extensible",
    concepts: [
      {
        tag: "interface",
        title: "A method says what to do",
        glyph: "method",
        body:
          "GET, POST, PUT, PATCH and DELETE express intent rather than mechanism. GET and DELETE are safe to repeat; PUT and DELETE are idempotent; POST is neither. That distinction is what lets a client retry a failed request without wondering whether it created a duplicate.",
      },
      {
        tag: "interface",
        title: "Status codes say what happened",
        glyph: "ack",
        body:
          "A three-digit class: 2xx succeeded, 3xx redirect, 4xx the client made a mistake, 5xx the server failed. One number lets a generic client — a browser, a cache, a crawler — decide what to do without knowing the application at all.",
      },
      {
        tag: "metadata",
        title: "Headers carry everything else",
        glyph: "session",
        body:
          "Content type, length, language, caching policy, authentication, compression. Headers are the extension point: features have been added for thirty years without changing the request line, which is why an old client still works.",
      },
      {
        tag: "state",
        title: "Cookies make a stateless protocol remember",
        glyph: "session",
        body:
          "HTTP itself keeps no memory between requests. State is carried by the client as a cookie and presented on each request, and the server keeps the matching record. The protocol stays stateless; the application adds the session.",
      },
      {
        tag: "performance",
        title: "Caching rules are part of the protocol",
        glyph: "cache",
        body:
          "Cache-Control, ETag and Last-Modified let any intermediary — browser, CDN, corporate proxy — serve a response without contacting the origin, and revalidate cheaply when it must. This is why pages with heavy images load quickly even on a small server.",
      },
      {
        tag: "evolution",
        title: "Versions changed the plumbing, not the meaning",
        glyph: "handshake",
        body:
          "HTTP/1.1 added persistent connections and pipelining. HTTP/2 added one multiplexed binary connection with header compression. HTTP/3 moved the same semantics onto QUIC over UDP, removing transport-level head-of-line blocking. Methods, status codes and headers are unchanged across all three.",
      },
    ],
  },

  mechanics: {
    headline: "How a request becomes a response",
    framing:
      "Follow one GET for a page. The protocol is thin — most of the difficulty is in what happens around it: naming, connecting, and deciding whether to ask at all.",
    stack: [
      { label: "Browser", sub: "the client" },
      { label: "HTTP", sub: "request / response semantics", emphasis: true },
      { label: "TCP", sub: "or QUIC, for HTTP/3" },
      { label: "IP", sub: "addressing and routing" },
      { label: "Server", sub: "originates the response" },
    ],
    steps: [
      {
        id: "url",
        title: "Resolve the URL",
        summary: "The address is split into scheme, host, path and query.",
        body:
          "A URL is not one thing. The scheme selects the protocol and the default port, the host must be resolved through DNS, the path names the resource, and the query string carries parameters. Getting this split right matters: the host determines where the request goes, the path determines what it asks for.",
        facts: [
          { key: "URL", value: "https://example.com/blog/post?id=42#comments" },
          { key: "Scheme", value: "https → TLS, default port 443" },
          { key: "Host", value: "example.com → must be resolved via DNS" },
          { key: "Path", value: "/blog/post" },
          { key: "Query", value: "id=42" },
          { key: "Fragment", value: "comments — never sent to the server" },
        ],
      },
      {
        id: "connect",
        title: "Open the transport connection",
        summary: "TCP (or QUIC) is established before any HTTP is sent.",
        body:
          "HTTP assumes a reliable, ordered byte stream, so it relies on the transport to create one. HTTP/1.1 and HTTP/2 use TCP, paying a handshake round trip; HTTPS adds a TLS handshake on top. HTTP/3 uses QUIC over UDP, which folds the transport and security handshakes together into a single round trip.",
        facts: [
          { key: "HTTP/1.1", value: "TCP, one request at a time per connection" },
          { key: "HTTP/2", value: "TCP, many streams multiplexed over one connection" },
          { key: "HTTP/3", value: "QUIC over UDP, streams independent of each other" },
        ],
      },
      {
        id: "request",
        title: "Send the request",
        summary: "A request line, headers, a blank line, and optionally a body.",
        body:
          "The message is text in HTTP/1.1: method, target, version, then headers, then a blank line, then the body if there is one. The blank line is how the receiver knows the headers have ended — which is why the framing of the body needs its own header, Content-Length or Transfer-Encoding, when there is one.",
        facts: [
          { key: "Request line", value: "GET /blog/post?id=42 HTTP/1.1" },
          { key: "Host header", value: "example.com — required in HTTP/1.1" },
          { key: "Accept", value: "text/html — content negotiation" },
          { key: "Compression", value: "Accept-Encoding: gzip, br" },
        ],
      },
      {
        id: "server",
        title: "The server handles it",
        summary: "Routing, application logic, and a decision from cache or origin.",
        body:
          "The server matches method and path against a route, runs whatever produces the resource, and builds a response. On the way back it declares how long the response may be cached and gives it a validator, so the client or a CDN can avoid asking again.",
        facts: [
          { key: "Route", value: "GET /blog/post → handler" },
          { key: "Cache-Control", value: "public, max-age=300" },
          { key: "ETag", value: '"a3f1c9" — a validator for cheap revalidation' },
        ],
      },
      {
        id: "response",
        title: "Send the response",
        summary: "Status code, headers, blank line, body.",
        body:
          "The status line carries the code and reason phrase. Headers describe the body — its type, its length, its encoding, and whether it may be cached. The body is the resource itself. A client that understands nothing about this application can still act correctly on a 404 or a 301.",
        facts: [
          { key: "Status line", value: "HTTP/1.1 200 OK" },
          { key: "Content-Type", value: "text/html; charset=utf-8" },
          { key: "Body", value: "the HTML document" },
        ],
      },
      {
        id: "cache",
        title: "Decide whether to ask again",
        summary: "Freshness first, then a conditional request.",
        body:
          "If a cached response is still fresh, the client uses it and sends nothing at all. If it has expired, the client revalidates: it sends the stored ETag or modification date and the server answers 304 Not Modified with an empty body if nothing changed. The saving is the body, which is usually the expensive part.",
        facts: [
          { key: "Fresh", value: "max-age not yet elapsed → no request" },
          { key: "Stale", value: "If-None-Match: \"a3f1c9\" → 304 Not Modified" },
          { key: "Changed", value: "200 OK with the new body" },
        ],
        sequence: {
          caption: "Conditional revalidation",
          nodes: [{ label: "Client" }, { label: "Cache / Server" }],
          arrows: [
            {
              from: 0,
              to: 1,
              label: "GET + If-None-Match",
              detail: '"a3f1c9"',
              tone: "accent",
            },
            {
              from: 1,
              to: 0,
              label: "304 Not Modified",
              detail: "headers only, no body",
              tone: "ok",
            },
          ],
        },
      },
      {
        id: "sessions",
        title: "Carry state with cookies",
        summary: "The client stores an opaque token and presents it each time.",
        body:
          "For anything personalised, the server sets a cookie on a response and the client returns it on every subsequent request to that origin. The cookie identifies a session; the server holds the data. Because the protocol itself is stateless, a server can be restarted or scaled horizontally without losing correctness, as long as the session store is shared.",
        facts: [
          { key: "Set-Cookie", value: "session=abc123; HttpOnly; Secure; SameSite=Lax" },
          { key: "Why HttpOnly", value: "JavaScript cannot read it, limiting XSS impact" },
          { key: "Why Secure", value: "sent only over HTTPS" },
        ],
      },
    ],
  },

  frame: {
    unit: "Message (request or response)",
    overhead: "Text headers, typically 300–800 bytes before any body",
    note:
      "HTTP/1.1 messages are text with CRLF line endings and a blank line separating headers from body. HTTP/2 and HTTP/3 replace the wire encoding with binary frames but keep these same fields, so the semantics below still describe them.",
    rows: [
      {
        label: "Request line",
        fields: [
          {
            name: "Method",
            size: "token",
            span: 1,
            tone: "accent",
            role: "What to do with the resource.",
            detail:
              "GET retrieves and must not change anything, so it can be retried and cached freely. HEAD is GET without a body and is used to check existence and metadata cheaply. POST submits data and is neither safe nor idempotent — replaying it may create a duplicate. PUT replaces a resource entirely and is idempotent. PATCH applies a partial modification. DELETE removes it and is idempotent. OPTIONS asks what is allowed, and is used for CORS preflight.",
            example: "GET",
          },
          {
            name: "Request Target",
            size: "path + query",
            span: 3,
            role: "The resource being requested.",
            detail:
              "Origin-form path such as /blog/post?id=42 for a direct request, absolute-form https://example.com/ when talking to a proxy, or a plain asterisk for OPTIONS *. Percent-encoding is how characters outside the safe set — spaces, slashes, non-ASCII — travel inside it.",
            example: "/blog/post?id=42",
          },
          {
            name: "Version",
            size: "token",
            span: 1,
            role: "Which HTTP version the message follows.",
            detail:
              "Only relevant on the HTTP/1.1 wire, where it is part of the request line. HTTP/2 and HTTP/3 negotiate the version out of band during connection setup and the field becomes redundant.",
            example: "HTTP/1.1",
          },
        ],
      },
      {
        label: "Response status line",
        fields: [
          {
            name: "Version",
            size: "token",
            span: 1,
            role: "Version of the response.",
            example: "HTTP/1.1",
          },
          {
            name: "Status Code",
            size: "3 digits",
            span: 2,
            tone: "ok",
            role: "The outcome, in a class any generic client can act on.",
            detail:
              "2xx — success. 200 OK, 201 Created, 204 No Content. 3xx — redirection or caching: 301 Moved Permanently, 302 Found, 304 Not Modified, 307/308 for method-preserving redirects. 4xx — the request was wrong: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests. 5xx — the server failed: 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout.",
            example: "200",
          },
          {
            name: "Reason Phrase",
            size: "token",
            span: 1,
            tone: "neutral",
            role: "Human-readable label for the code.",
            detail:
              "Purely cosmetic, and ignored by clients. Its content is not guaranteed or machine-readable, so logic must key on the number. HTTP/2 dropped it entirely.",
            example: "OK",
          },
        ],
      },
      {
        label: "Headers",
        fields: [
          {
            name: "Request headers",
            size: "name: value pairs",
            span: 2,
            tone: "accent",
            role: "What the client wants, and about itself.",
            detail:
              "Host (mandatory in HTTP/1.1, and what makes virtual hosting possible), User-Agent, Accept and Accept-Language for content negotiation, Accept-Encoding for compression, Authorization for credentials, Cookie for session state, Referer, and If-None-Match for conditional requests.",
            example: "Accept: text/html",
          },
          {
            name: "Response headers",
            size: "name: value pairs",
            span: 2,
            tone: "ok",
            role: "What came back, and how to handle it.",
            detail:
              "Content-Type and Content-Length describe the body. Cache-Control, ETag and Last-Modified control caching. Set-Cookie establishes state. Location accompanies a redirect. Access-Control-Allow-Origin governs cross-origin access. Strict-Transport-Security and Content-Security-Policy let a server instruct the browser to defend itself.",
            example: "Content-Type: text/html; charset=utf-8",
          },
        ],
      },
      {
        label: "Body",
        fields: [
          {
            name: "Payload",
            size: "arbitrary",
            span: 4,
            role: "The resource, or the data being submitted.",
            detail:
              "Framing must be declared: Content-Length for a known size, chunked transfer encoding for a stream whose length is not yet known, or — in HTTP/2 and later — explicit DATA frames. Its format is stated by Content-Type and negotiated by Accept: HTML, JSON, images, form submissions, range-limited video, event streams. The same message shape carries all of them, which is why one protocol serves both documents and APIs.",
            example: "<!doctype html>…",
          },
        ],
      },
    ],
  },

  realWorld: {
    title: "A browser fetches a JSON API response",
    scenario:
      "A single-page app loads data without reloading. The same protocol that delivered the page now delivers its data, with different headers and a different body — but an identical message structure.",
    hops: [
      {
        label: "Client",
        sub: "JavaScript fetch() call",
        facts: [
          { key: "Request", value: "GET /api/v1/atlas?id=tcp" },
          { key: "Origin", value: "https://app.example.com" },
        ],
      },
      {
        label: "Preflight",
        sub: "cross-origin request needs permission first",
        facts: [
          { key: "Trigger", value: "non-simple header or method" },
          { key: "Request", value: "OPTIONS /api/v1/atlas" },
          { key: "Response", value: "Access-Control-Allow-Origin: https://app.example.com" },
        ],
      },
      {
        label: "Transport",
        sub: "reused TLS connection",
        facts: [
          { key: "Port", value: "443" },
          { key: "Reuse", value: "HTTP/2 multiplexes many requests on one connection" },
        ],
      },
      {
        label: "Server",
        sub: "route handler",
        facts: [
          { key: "Auth", value: "Authorization: Bearer …" },
          { key: "Logic", value: "query the database, build JSON" },
        ],
      },
      {
        label: "Response",
        sub: "typed, cacheable, compressed",
        facts: [
          { key: "Status", value: "200 OK" },
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "private, max-age=0, must-revalidate" },
          { key: "ETag", value: '"7d1f…"' },
        ],
      },
      {
        label: "Client renders",
        sub: "the same 200 that carried the HTML",
        facts: [
          { key: "Behaviour", value: "parse JSON, update the DOM" },
          { key: "Errors", value: "401 → re-authenticate, 429 → back off, 404 → empty state" },
        ],
      },
    ],
    moral:
      "HTTP does not care whether the body is a document or a data structure — Content-Type tells the client which it is, and the status code tells it how to proceed. That generality is why the same protocol serves web pages, REST APIs and video streaming, and why a developer can reason about a new service using only the method, the status code and the headers.",
  },

  comparison: {
    title: "HTTP/1.1 vs HTTP/2 vs HTTP/3",
    framing:
      "The semantics — methods, status codes, headers — are identical in all three. Everything that changed is transport plumbing, and each version exists to remove a specific bottleneck the previous one hit.",
    columns: [
      { label: "HTTP/1.1", accentToken: "--color-http", accentHex: "#e9a13f", emphasis: true },
      { label: "HTTP/2", accentToken: "--color-http", accentHex: "#e9a13f" },
      { label: "HTTP/3", accentToken: "--color-http", accentHex: "#e9a13f" },
    ],
    rows: [
      {
        dimension: "Transport",
        cells: ["TCP", "TCP", "QUIC over UDP"],
      },
      {
        dimension: "Wire format",
        cells: ["Text, CRLF-delimited", "Binary frames", "Binary frames"],
      },
      {
        dimension: "Concurrency",
        cells: [
          "One request per connection at a time; browsers open ~6 parallel connections per host",
          "Many streams multiplexed on one connection",
          "Many streams, independently ordered",
        ],
      },
      {
        dimension: "Head-of-line blocking",
        cells: [
          "At the request level — a slow response blocks the next request",
          "Fixed at the HTTP level, but still present inside TCP",
          "Removed — a lost packet delays only its own stream",
        ],
      },
      {
        dimension: "Header overhead",
        cells: [
          "Sent in full on every request, uncompressed",
          "HPACK compression with a shared dynamic table",
          "QPACK compression, adapted for out-of-order delivery",
        ],
      },
      {
        dimension: "Server push",
        cells: ["Not available", "Defined, but widely abandoned in practice", "Not available"],
      },
      {
        dimension: "Connection setup",
        cells: [
          "1 RTT for TCP, plus 1 for TLS",
          "Same as HTTP/1.1",
          "Combined transport and TLS handshake, 1 RTT — or 0 on resumption",
        ],
      },
      {
        dimension: "Encryption",
        cells: ["Optional", "Optional in the spec, mandatory in every browser", "Always — QUIC is encrypted by design"],
      },
      {
        dimension: "Suffers on loss when",
        cells: [
          "Any packet is lost, on any concurrent connection",
          "Any packet is lost, stalling all streams at once",
          "Almost never — only the affected stream stalls",
        ],
      },
      {
        dimension: "Change required to adopt",
        cells: [
          "Baseline",
          "Server and browser support; no application change",
          "Server and browser support, plus UDP to be reachable end to end",
        ],
      },
    ],
  },

  recap: {
    headline: "HTTP in 20 seconds",
    points: [
      "Application layer, stateless, request/response. It defines meaning, not delivery.",
      "A method states intent: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS — safe and idempotent where it matters.",
      "A three-digit status code lets any generic client act: 2xx success, 3xx redirect, 4xx your fault, 5xx theirs.",
      "Headers are the extension point — content type, framing, caching, auth, cookies, security policy.",
      "Caching and revalidation are protocol features, not an afterthought: Cache-Control, ETag, 304 Not Modified.",
      "Cookies move state to the client so the server can stay stateless and scale horizontally.",
      "Versions changed the transport, not the vocabulary: HTTP/2 multiplexes on one TCP connection, HTTP/3 moves to QUIC over UDP and removes head-of-line blocking.",
    ],
  },

  related: ["https", "tcp", "udp"],

  references: [
    {
      label: "RFC 9110 — HTTP Semantics",
      note: "Methods, status codes, headers and their meaning, across all versions.",
    },
    {
      label: "RFC 9112 — HTTP/1.1",
      note: "The text wire format and message framing.",
    },
    {
      label: "RFC 9113 — HTTP/2",
      note: "Binary framing, stream multiplexing and HPACK.",
    },
    {
      label: "RFC 9114 — HTTP/3",
      note: "HTTP mapped onto QUIC, and QPACK header compression.",
    },
    {
      label: "RFC 6265 — HTTP State Management Mechanism",
      note: "Cookies: how state is carried by a stateless protocol.",
    },
  ],
};
