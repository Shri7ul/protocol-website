import { ACCENTS } from "../accents";
import type { ProtocolDefinition } from "../types";

export const https: ProtocolDefinition = {
  id: "https",
  name: "HTTPS",
  longName: "HyperText Transfer Protocol Secure",
  subtitle: "HTTP carried inside TLS",
  layer: "Application Layer",
  layerId: "application",
  communication: "Request / Response over an encrypted channel",
  purpose: "Confidentiality, integrity and authentication for HTTP",
  hook:
    "The same HTTP you already know, wrapped in a tunnel that nobody in the middle can read, alter, or impersonate.",
  intro:
    "HTTPS is not a separate protocol. It is HTTP sent over a TLS connection — the request and response are byte for byte what they would have been, but they are encrypted and integrity-protected before they reach the transport layer. What TLS adds is three properties HTTP never had on its own: nobody on the path can read the traffic, nobody can modify it without detection, and you can verify you are talking to the host you named rather than an impostor.",
  accent: ACCENTS.https,

  problem: {
    headline: "Plain HTTP is a postcard, not a sealed letter",
    detail:
      "Every device on the path between you and the server can read and change an unencrypted request: the Wi-Fi access point, the ISP, a corporate proxy, a router in another country. Passwords and session cookies travel in the clear, so anyone on the same network can lift them. There is also no way to know that the server answering is the one you asked for — DNS can be poisoned and traffic can be redirected, and a convincing fake looks identical to the real thing.",
    failures: [
      "Confidentiality: cookies, passwords and tokens are readable by anyone on the path",
      "Integrity: an attacker can inject content into a page or alter a response in flight",
      "Authentication: nothing proves the server is who it claims to be",
      "Impersonation: DNS spoofing or a rogue access point can redirect you to a convincing fake",
      "Tracking: intermediaries can profile and monetise what you read and buy",
      "Protocol downgrade: an attacker can force a connection back to plain HTTP",
    ],
  },
  solution: {
    headline: "Three guarantees, one handshake",
    concepts: [
      {
        tag: "confidentiality",
        title: "Encryption",
        glyph: "encrypt",
        body:
          "Traffic is encrypted with a symmetric cipher, because symmetric cryptography is fast enough to run at line rate. The key is generated fresh for each connection and shared using asymmetric cryptography, which solves the problem of agreeing on a secret over a channel someone else is listening to.",
      },
      {
        tag: "integrity",
        title: "Authenticated encryption",
        glyph: "integrity",
        body:
          "Every record carries an authentication tag computed over its contents. A single altered bit invalidates the tag and the record is rejected — so tampering is detected rather than silently accepted. Modern TLS achieves this in one construction (AEAD, such as AES-GCM or ChaCha20-Poly1305) rather than encrypt-then-check.",
      },
      {
        tag: "identity",
        title: "Certificates",
        glyph: "identity",
        body:
          "A certificate binds a public key to a hostname and is signed by a Certificate Authority the client already trusts. During the handshake the server proves it holds the matching private key, so the certificate cannot simply be copied by an impostor.",
      },
      {
        tag: "trust",
        title: "Certificate Authorities",
        glyph: "identity",
        body:
          "Rather than trusting millions of servers directly, a client ships with a few hundred trusted roots and verifies a chain of signatures up to one of them. A CA may revoke a certificate, and must be publicly auditable — this is the weakest link in the model, which is why certificate transparency logs exist.",
      },
      {
        tag: "key exchange",
        title: "The TLS handshake",
        glyph: "handshake",
        body:
          "The client and server agree on a cipher suite, verify the certificate, and derive a shared secret. Ephemeral key exchange (ECDHE) means the session key cannot be recovered even if the server's long-term private key is later stolen — forward secrecy.",
      },
      {
        tag: "performance",
        title: "Session resumption and 0-RTT",
        glyph: "cache",
        body:
          "A previous session can be resumed with a ticket rather than a full handshake, saving a round trip. TLS 1.3 supports sending early data before the handshake completes, at the cost of replay-protection guarantees the application must handle itself.",
      },
      {
        tag: "policy",
        title: "HSTS and downgrade protection",
        glyph: "identity",
        body:
          "Strict-Transport-Security tells the browser to refuse plain HTTP for that host for a set period, closing the window where a user types a bare hostname and an attacker intercepts the first request. Preloading extends this to the very first visit.",
      },
    ],
  },

  mechanics: {
    headline: "How a secure request is established",
    framing:
      "Follow a TLS 1.3 handshake. The expensive part — asymmetric cryptography — happens once at the start; everything after it is fast symmetric encryption over a connection that already exists.",
    stack: [
      { label: "Browser", sub: "the client" },
      { label: "HTTP", sub: "unchanged request and response" },
      { label: "TLS", sub: "encryption, integrity, identity", emphasis: true },
      { label: "TCP / QUIC", sub: "ordered delivery" },
      { label: "IP", sub: "addressing and routing" },
    ],
    steps: [
      {
        id: "connect",
        title: "Connect to port 443",
        summary: "A transport connection is opened before any TLS bytes.",
        body:
          "Over TCP, the connection is established first and TLS runs inside it. Over QUIC the two are combined, which is where HTTP/3's single-round-trip setup comes from. Either way, HTTPS runs on port 443 by convention — a convention, not a requirement, but one every middlebox depends on.",
        facts: [
          { key: "Port", value: "443 (by convention)" },
          { key: "HTTP/1.1 & 2", value: "TCP connect, then TLS handshake" },
          { key: "HTTP/3", value: "QUIC, handshake combined with TLS" },
        ],
      },
      {
        id: "hello",
        title: "Negotiate the cipher suite",
        summary: "ClientHello and ServerHello agree on algorithms and a shared secret.",
        body:
          "The client sends the TLS versions and cipher suites it supports, plus a key share for its preferred ephemeral key exchange. The server picks the suite, sends its own key share, and derives the same shared secret independently. In TLS 1.3 the server sends its certificate and finished message in the same flight, so the whole exchange completes in one round trip.",
        facts: [
          { key: "Key exchange", value: "ECDHE — ephemeral, forward secret" },
          { key: "TLS 1.3", value: "1 RTT, versus 2 for TLS 1.2" },
          { key: "0-RTT", value: "possible on resumption, with replay caveats" },
        ],
        sequence: {
          caption: "TLS 1.3 handshake",
          nodes: [{ label: "Client" }, { label: "Server" }],
          arrows: [
            {
              from: 0,
              to: 1,
              label: "ClientHello",
              detail: "versions, cipher suites, key share",
              tone: "accent",
            },
            {
              from: 1,
              to: 0,
              label: "ServerHello",
              detail: "chosen suite, key share, certificate, finished",
              tone: "accent",
            },
            {
              from: 0,
              to: 1,
              label: "Finished",
              detail: "handshake complete, encrypted from here on",
              tone: "ok",
            },
          ],
        },
      },
      {
        id: "verify",
        title: "Verify the certificate",
        summary: "Chain of trust, hostname match, validity dates, revocation.",
        body:
          "The client walks the chain of signatures up to a trusted root, checks that the certificate covers the hostname it requested, checks the validity window, and checks that the certificate has not been revoked. Only then does it accept the server's public key as belonging to that name. If any check fails, the browser refuses the connection loudly — this refusal is the entire value of the scheme.",
        facts: [
          { key: "Chain", value: "leaf → intermediate → trusted root" },
          { key: "Names checked", value: "subjectAltName, not the legacy common name" },
          { key: "Revocation", value: "CRL or OCSP; soft-fail by default in browsers" },
        ],
      },
      {
        id: "keys",
        title: "Derive session keys",
        summary: "One handshake secret becomes symmetric keys for the traffic.",
        body:
          "The shared secret plus both sides' random values are run through a key derivation function to produce separate keys for each direction, plus IVs and the authentication secrets. From here on the connection is symmetric encryption, which costs orders of magnitude less CPU than the public-key operations in the handshake. That asymmetry is why a handshake per connection is affordable.",
        facts: [
          { key: "Cipher", value: "AES-GCM or ChaCha20-Poly1305" },
          { key: "Keys", value: "separate for client→server and server→client" },
          { key: "Forward secrecy", value: "session key not recoverable from the private key alone" },
        ],
      },
      {
        id: "exchange",
        title: "Send the HTTP exchange, encrypted",
        summary: "The request and response are wrapped in encrypted TLS records.",
        body:
          "The HTTP message is unchanged — the same request line, headers and body. TLS fragments it into records, encrypts each with the session key, and appends an authentication tag. The receiver verifies each tag before decrypting, so a modified record is dropped rather than acted on. Nothing about the HTTP semantics changes; the transport and security layers are entirely below it.",
        facts: [
          { key: "On the wire", value: "opaque bytes: record header + ciphertext + tag" },
          { key: "Visible to an observer", value: "destination IP, port, and rough sizes and timings" },
          { key: "Hidden", value: "the path, the headers, cookies, and the body" },
        ],
      },
      {
        id: "mitm",
        title: "What an attacker on the path sees",
        summary: "Traffic they can neither read, alter, nor convincingly impersonate.",
        body:
          "A passive observer sees that a connection to a given IP on port 443 exists, and can infer roughly how many bytes moved. They cannot read the request. An active attacker who tries to intercept sees a name mismatch or an untrusted chain and the client aborts. The remaining exposures are real but narrower: DNS is frequently unencrypted, IP addresses and timing leak metadata, and a compromised or coerced Certificate Authority can still issue a valid certificate for a name it does not own.",
        facts: [
          { key: "Protects against", value: "passive reading, tampering, server impersonation" },
          { key: "Does not protect", value: "metadata, endpoint compromise, a rogue trusted CA" },
        ],
        sequence: {
          caption: "Interception fails at the certificate check",
          nodes: [{ label: "Client" }, { label: "Attacker" }, { label: "Real server" }],
          arrows: [
            { from: 0, to: 1, label: "ClientHello", tone: "accent" },
            {
              from: 1,
              to: 0,
              label: "forged certificate",
              detail: "name mismatch or untrusted chain",
              tone: "danger",
            },
            {
              from: 0,
              to: 1,
              label: "connection aborted",
              detail: "no key ever shared",
              tone: "warn",
            },
          ],
        },
      },
    ],
  },

  frame: {
    unit: "TLS record",
    overhead: "5-byte record header, plus up to 16 bytes of AEAD tag",
    note:
      "HTTP itself is unchanged inside the tunnel, so the fields that matter are TLS's. The first byte or two of a record are visible on the wire; everything after the header is ciphertext.",
    rows: [
      {
        label: "Record header — 5 bytes, in the clear",
        fields: [
          {
            name: "Content Type",
            size: "1 byte",
            span: 1,
            tone: "accent",
            role: "What kind of record this is.",
            detail:
              "22 = handshake, 23 = application data (the actual HTTP), 20 = change cipher spec (TLS 1.2 only), 21 = alert. A passive observer can tell a handshake from data, but nothing more.",
            example: "23",
          },
          {
            name: "Legacy Version",
            size: "2 bytes",
            span: 1,
            tone: "neutral",
            role: "Version field, pinned for compatibility.",
            detail:
              "The real version is negotiated in the handshake; this field is fixed at 0x0303 (TLS 1.2) in TLS 1.3 for interoperability with middleboxes that inspect it. A good reminder that protocol deployment is a social problem as well as a technical one.",
            example: "0x0303",
          },
          {
            name: "Length",
            size: "2 bytes",
            span: 2,
            role: "Length of the encrypted payload in this record.",
            detail:
              "Kept small enough that a record fits inside one TCP segment on most paths, which avoids fragmentation and lets a lost record be retransmitted without delaying the rest of the connection.",
            example: "1448",
          },
        ],
      },
      {
        label: "Handshake messages — exchanged once, at setup",
        fields: [
          {
            name: "ClientHello",
            size: "variable",
            span: 2,
            role: "The client's proposal and its key share.",
            detail:
              "Contains supported versions, a list of cipher suites, a random nonce, the server name (SNI — visible to the network unless Encrypted Client Hello is in use), and for TLS 1.3 an ephemeral key share so the handshake can finish in one round trip.",
            example: "TLS 1.3, x25519, AES-128-GCM",
          },
          {
            name: "ServerHello + Certificate",
            size: "variable",
            span: 2,
            role: "The server's choice, key share, and proof of identity.",
            detail:
              "In TLS 1.3 the server's flight also carries the certificate chain and a Finished MAC, so the client can verify authenticity and integrity in the same round trip that establishes the secret.",
            example: "chain: leaf + intermediate",
          },
        ],
      },
      {
        label: "Encrypted payload",
        fields: [
          {
            name: "Ciphertext",
            size: "up to 16 KB per record",
            span: 4,
            role: "The encrypted HTTP request or response.",
            detail:
              "Encrypted with the negotiated AEAD cipher and a per-key nonce. Length upto the record limit; larger HTTP bodies span many records. Because encryption preserves length, an observer can still estimate payload size — a genuine and well-known metadata leak.",
            example: "GET / HTTP/2 · · · encrypted · · ·",
          },
        ],
      },
      {
        label: "Integrity",
        fields: [
          {
            name: "Auth Tag (AEAD)",
            size: "8–16 bytes",
            span: 2,
            tone: "ok",
            role: "Proof that this record was not modified.",
            detail:
              "A keyed MAC over the record contents. The receiver verifies it before decrypting, so an altered record never reaches the application. This is what makes tampering detectable rather than merely difficult.",
            example: "0x9c4e…",
          },
          {
            name: "Nonce / IV",
            size: "derived",
            span: 2,
            tone: "neutral",
            role: "Prevents identical plaintext producing identical ciphertext.",
            detail:
              "Derived from the session key and a sequence number, so it never repeats within a connection. Reusing a nonce with the same key is catastrophic for GCM, which is why implementations derive it rather than transmit it.",
            example: "derived, not transmitted",
          },
        ],
      },
    ],
  },

  realWorld: {
    title: "Signing in to a bank over HTTPS",
    scenario:
      "You enter a password on a page that loaded from a bare hostname. Trace what is actually protected, and what a network attacker can still observe.",
    hops: [
      {
        label: "Navigation",
        sub: "typed hostname, no scheme",
        facts: [
          { key: "Entered", value: "bank.example" },
          { key: "Attempt", value: "HTTP first, then upgraded by HSTS" },
          { key: "Risk closed", value: "a fresh install has no HSTS entry on first visit" },
        ],
      },
      {
        label: "Certificate",
        sub: "chain verified before anything is sent",
        facts: [
          { key: "Subject", value: "CN=bank.example, SAN covers www.bank.example" },
          { key: "Issuer", value: "a publicly trusted CA" },
          { key: "Validation", value: "chain, hostname, validity window, revocation" },
        ],
      },
      {
        label: "TLS 1.3 handshake",
        sub: "one round trip, forward secret",
        facts: [
          { key: "Key exchange", value: "ECDHE (x25519)" },
          { key: "Cipher", value: "AES-128-GCM" },
          { key: "Forward secrecy", value: "yes — past sessions stay secret if the key later leaks" },
        ],
      },
      {
        label: "Login request, encrypted",
        sub: "credentials inside the tunnel",
        facts: [
          { key: "Method", value: "POST /login" },
          { key: "Body", value: "username + password — ciphertext on the wire" },
          { key: "Cookie", value: "Secure, HttpOnly, SameSite=Lax" },
        ],
      },
      {
        label: "Response",
        sub: "session established, still encrypted",
        facts: [
          { key: "Status", value: "303 See Other → /dashboard" },
          { key: "Set-Cookie", value: "session=…; Secure; HttpOnly" },
          { key: "Extra header", value: "Strict-Transport-Security: max-age=63072000" },
        ],
      },
      {
        label: "What an observer still sees",
        sub: "the honest limits of the protection",
        facts: [
          { key: "Learnable", value: "that you connected to bank.example, when, and roughly how much data" },
          { key: "Not learnable", value: "which page, the password, or the session cookie" },
          { key: "Caveat", value: "the DNS lookup for bank.example may itself be unencrypted" },
        ],
      },
    ],
    moral:
      "HTTPS protects content and authenticity, not identity or metadata. The password and session cookie are unreadable and unmodifiable in transit, and a fake server cannot present a valid certificate for the name — which is the point. But the fact that you visited the site, when, and how much you transferred is still visible to anyone on the path, and a first visit over a bare hostname is a genuine window unless HSTS is preloaded.",
  },

  comparison: {
    title: "HTTP vs HTTPS",
    framing:
      "The HTTP semantics are identical in both columns. Everything that differs is below the application layer — which is exactly why adopting HTTPS required no changes to web applications.",
    columns: [
      { label: "HTTP", accentToken: "--color-http", accentHex: "#e9a13f", emphasis: true },
      { label: "HTTPS", accentToken: "--color-https", accentHex: "#4cc98a" },
    ],
    rows: [
      {
        dimension: "Default port",
        cells: ["80", "443"],
      },
      {
        dimension: "Confidentiality",
        cells: ["None — plaintext on the wire", "Encrypted with a per-connection symmetric key"],
      },
      {
        dimension: "Integrity",
        cells: [
          "Only a 16-bit transport checksum, which detects accidental corruption, not tampering",
          "AEAD authentication tag on every record",
        ],
      },
      {
        dimension: "Server authentication",
        cells: ["None — any host can answer", "X.509 certificate chain validated against trusted roots"],
      },
      {
        dimension: "Key exchange",
        cells: ["Not applicable", "Ephemeral ECDHE — forward secret"],
      },
      {
        dimension: "Setup cost",
        cells: ["TCP handshake only", "TCP handshake + TLS handshake (1 RTT in TLS 1.3)"],
      },
      {
        dimension: "Latency on a warm connection",
        cells: ["Baseline", "Indistinguishable — resumption and 0-RTT remove most of the cost"],
      },
      {
        dimension: "Certificate required",
        cells: ["No", "Yes — or a self-signed cert the client must be told to trust"],
      },
      {
        dimension: "Browser treatment",
        cells: ["Marked 'Not secure'", "Padlock; modern features (geolocation, service workers, HTTP/2) require it"],
      },
      {
        dimension: "Protects against MITM",
        cells: ["No — trivially interceptable", "Yes, for content and identity"],
      },
      {
        dimension: "SEO and features",
        cells: ["Deprioritised, restricted APIs", "Preferred, full API access"],
      },
      {
        dimension: "Relationship to HTTP/3",
        cells: ["N/A", "HTTP/3 runs over QUIC, which always encrypts — there is no plaintext HTTP/3"],
      },
    ],
  },

  recap: {
    headline: "HTTPS in 20 seconds",
    points: [
      "Not a separate protocol: HTTP messages carried inside a TLS connection, on port 443 by convention.",
      "Three guarantees — confidentiality (encryption), integrity (AEAD tags), authentication (certificates).",
      "A certificate binds a public key to a hostname, signed by a CA the client already trusts.",
      "The handshake negotiates a cipher suite and derives a fresh symmetric key using ephemeral ECDHE.",
      "Forward secrecy means a stolen long-term private key cannot decrypt past sessions.",
      "TLS 1.3 completes the handshake in one round trip; resumption and 0-RTT make the cost near-zero on later connections.",
      "It protects content and identity — not metadata. Destination, timing and size remain observable.",
    ],
  },

  related: ["http", "tcp", "udp"],

  references: [
    {
      label: "RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3",
      note: "The current TLS specification: 1-RTT handshake, mandatory forward secrecy, AEAD-only ciphers.",
    },
    {
      label: "RFC 5280 — Internet X.509 Public Key Infrastructure",
      note: "Certificate and CRL profile — how identity is encoded and chained.",
    },
    {
      label: "RFC 6797 — HTTP Strict Transport Security (HSTS)",
      note: "How a host instructs a browser to refuse plain HTTP.",
    },
    {
      label: "RFC 9114 — HTTP/3",
      note: "HTTP mapped onto QUIC, which is always encrypted.",
    },
  ],
};
