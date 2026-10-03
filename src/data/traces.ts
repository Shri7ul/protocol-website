/**
 * The two tracing scenarios.
 *
 * These are data, not markup, for the same reason the protocols are: the
 * TraceVisualizer renders any scenario, and both of these are the same shape.
 */

export interface TraceStage {
  id: string;
  /** Short name of the actor for this stage. */
  label: string;
  /** What is happening, as a heading. */
  headline: string;
  /** One or two sentences of explanation. */
  body: string;
  /** Concrete values visible at this stage. */
  facts: { key: string; value: string }[];
  /** Which protocol accent to light this stage with. */
  accent: "tcp" | "udp" | "http" | "https" | "i2c" | "can" | "neutral";
  /** Layer label, shown as a chip. */
  layer: string;
}

/** ---------------------------------------------------------------- *
 * TRACE A REQUEST — the browser-to-server path
 * ---------------------------------------------------------------- */

export const webRequestStages: TraceStage[] = [
  {
    id: "url",
    label: "You type example.com",
    headline: "A name, not an address",
    body:
      "The browser has a hostname and nothing else. It cannot open a connection to a name — the network only knows how to reach an address. So the first thing that happens is not a network operation at all: it is a lookup.",
    facts: [
      { key: "Input", value: "example.com" },
      { key: "Scheme", value: "none given → assume HTTPS" },
      { key: "Known yet", value: "nothing about where this lives" },
    ],
    accent: "neutral",
    layer: "Application",
  },
  {
    id: "dns",
    label: "DNS resolver",
    headline: "Name → address",
    body:
      "Usually over UDP on port 53, the resolver is asked for the A (IPv4) or AAAA (IPv6) record. It may answer from cache in microseconds, or walk the hierarchy from the root servers down. The answer comes back as an address plus a TTL saying how long it may be cached.",
    facts: [
      { key: "Transport", value: "UDP port 53" },
      { key: "Question", value: "example.com A?" },
      { key: "Answer", value: "93.184.216.34" },
      { key: "TTL", value: "86 400 s" },
    ],
    accent: "udp",
    layer: "Application",
  },
  {
    id: "tcp",
    label: "TCP connection",
    headline: "Open a reliable channel",
    body:
      "Now there is an address, the browser can connect. It picks an ephemeral source port and opens a TCP connection to port 443. That costs one full round trip — SYN, SYN-ACK, ACK — before a single byte of the request can be sent. In HTTP/3 this step is folded into the QUIC handshake instead.",
    facts: [
      { key: "Destination", value: "93.184.216.34:443" },
      { key: "Source port", value: "52104 (ephemeral)" },
      { key: "Handshake", value: "SYN → SYN-ACK → ACK" },
      { key: "Cost", value: "1 RTT" },
    ],
    accent: "tcp",
    layer: "Transport",
  },
  {
    id: "tls",
    label: "TLS handshake",
    headline: "Verify identity, agree a secret",
    body:
      "HTTPS layers TLS on top. The client offers cipher suites and a key share; the server returns its choice, its certificate chain and its own key share. The client validates the chain against a trusted root and checks that the certificate matches the hostname. Both sides then derive the same symmetric session key — a key that never travels across the network.",
    facts: [
      { key: "Certificate", value: "CN=example.com, issued by a trusted CA" },
      { key: "Key exchange", value: "ECDHE (x25519) — forward secret" },
      { key: "Cipher", value: "TLS_AES_128_GCM_SHA256" },
      { key: "Cost", value: "1 more RTT (TLS 1.3)" },
    ],
    accent: "https",
    layer: "Application / Security",
  },
  {
    id: "request",
    label: "HTTPS request",
    headline: "Ask for the resource",
    body:
      "Only now does the actual HTTP request travel. It is text, encrypted inside TLS records: a request line, headers, a blank line. The Host header is what lets one server at one address serve many different sites — the reason virtual hosting works at all.",
    facts: [
      { key: "Request line", value: "GET / HTTP/2" },
      { key: "Host", value: "example.com" },
      { key: "Accept", value: "text/html,application/xhtml+xml" },
      { key: "Accept-Encoding", value: "gzip, br" },
      { key: "User-Agent", value: "Mozilla/5.0 …" },
    ],
    accent: "http",
    layer: "Application",
  },
  {
    id: "server",
    label: "Origin server",
    headline: "Route, authorise, generate",
    body:
      "The request is decrypted, the route is matched, and the application produces the resource. It then declares how the response may be cached and gives it a validator, so the next visit can be answered with headers alone.",
    facts: [
      { key: "Route", value: "GET / → static / index" },
      { key: "Cache-Control", value: "max-age=600" },
      { key: "ETag", value: '"3147526947"' },
      { key: "Encoding", value: "gzip" },
    ],
    accent: "http",
    layer: "Application",
  },
  {
    id: "response",
    label: "HTTPS response",
    headline: "Status, headers, body",
    body:
      "The response travels back through the same encrypted channel. The status code lets any client — a browser, a cache, a crawler — act correctly without knowing the application. The body is compressed and the connection may be kept open for further requests.",
    facts: [
      { key: "Status", value: "200 OK" },
      { key: "Content-Type", value: "text/html; charset=UTF-8" },
      { key: "Content-Encoding", value: "gzip" },
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
    ],
    accent: "https",
    layer: "Application",
  },
  {
    id: "render",
    label: "Browser renders",
    headline: "Parse, then repeat for every asset",
    body:
      "The HTML is parsed into a document tree. Images, stylesheets and scripts are discovered as sub-resources, and each one is another request over the connection that already exists — no new handshake needed. HTTP/2 and HTTP/3 multiplex these concurrently on the one connection.",
    facts: [
      { key: "Round trips so far", value: "DNS + TCP + TLS + request/response" },
      { key: "Sub-resources", value: "typically 20–100 more requests" },
      { key: "Reused", value: "existing TLS connection, no new handshake" },
    ],
    accent: "neutral",
    layer: "Application",
  },
];

/** ---------------------------------------------------------------- *
 * TRACE A ROBOT — the embedded bus path
 * ---------------------------------------------------------------- */

export const robotStages: TraceStage[] = [
  {
    id: "loop",
    label: "Main controller · 1 kHz loop",
    headline: "A deterministic control cycle",
    body:
      "Unlike a web request, nothing here is best-effort. The controller wakes on a timer — every millisecond — samples its sensors, runs the control law, and commands its actuators. If a step takes too long, the robot does not slow down gracefully; it becomes unstable. Every bus on the robot has a latency budget derived from this loop.",
    facts: [
      { key: "Cycle time", value: "1000 µs, hard deadline" },
      { key: "Buses", value: "CAN for controllers, I²C for sensors" },
      { key: "Tolerance", value: "no jitter — a late read is a wrong read" },
    ],
    accent: "neutral",
    layer: "Control loop",
  },
  {
    id: "i2c-imu",
    label: "I²C → IMU",
    headline: "Short, fast, local sensor read",
    body:
      "The inertial measurement unit sits millimetres from the controller, so it goes on I²C: two pins, no transceiver, no termination. That is the whole reason I²C exists — this device would never justify four extra traces. The cost is that I²C is slow, so the IMU is usually the one sensor that gets a dedicated bus or moves to SPI if the control rate rises.",
    facts: [
      { key: "Device", value: "IMU at address 0x68" },
      { key: "Registers", value: "0x3B–0x40, six bytes of accel and gyro" },
      { key: "Clock", value: "400 kHz fast mode" },
      { key: "Latency", value: "≈ 300 µs including the transaction overhead" },
    ],
    accent: "i2c",
    layer: "Embedded bus",
  },
  {
    id: "i2c-oled",
    label: "I²C → OLED",
    headline: "The same bus, a very different device",
    body:
      "The status display shares the same two wires. It is the slowest thing on the bus by an order of magnitude — pushing a framebuffer over 400 kHz takes milliseconds — which is exactly the kind of device that makes I²C a poor fit for high-rate sensing. On a real design, the display is often moved to its own bus or refreshed only from a low-priority task.",
    facts: [
      { key: "Device", value: "SSD1306 at 0x3C" },
      { key: "Payload", value: "~1 KB framebuffer per refresh" },
      { key: "Rate", value: "10 Hz at most, without starving the IMU" },
      { key: "Conflict", value: "shares a bus with a 1 kHz sensor — a genuine design tension" },
    ],
    accent: "i2c",
    layer: "Embedded bus",
  },
  {
    id: "can-motor",
    label: "CAN → motor controller",
    headline: "High priority, because it moves the robot",
    body:
      "The motor controllers are a metre away in an electrically noisy environment, so they go on CAN: differential signalling over a terminated twisted pair. The torque command is given a low identifier value, which means it wins arbitration against everything slower on the bus without any software priority logic. Priority is wired into the identifier, decided at design time.",
    facts: [
      { key: "Identifier", value: "0x1A0 — high priority" },
      { key: "Payload", value: "8 bytes: torque, speed, temperature, status" },
      { key: "Bit rate", value: "500 kbit/s, or 1 Mbit/s" },
      { key: "Latency", value: "bounded and provable — that is the point of arbitration" },
    ],
    accent: "can",
    layer: "Embedded bus",
  },
  {
    id: "can-battery",
    label: "CAN → battery controller",
    headline: "The same bus, carrying data at a tenth the rate",
    body:
      "Battery pack voltage, current and cell temperatures change slowly, so this message goes out at 10 Hz with a higher identifier — lower priority. It loses arbitration to the motor command whenever they collide, and loses it *losslessly*: nothing is dropped, the battery frame simply waits for the bus to go idle again a few hundred microseconds later.",
    facts: [
      { key: "Identifier", value: "0x2C0 — medium priority" },
      { key: "Rate", value: "10 Hz" },
      { key: "Payload", value: "pack voltage, current, min and max cell temperature" },
      { key: "On losing arbitration", value: "retransmits automatically, no data lost" },
    ],
    accent: "can",
    layer: "Embedded bus",
  },
  {
    id: "can-error",
    label: "CAN error handling",
    headline: "A damaged wire degrades one node, not the robot",
    body:
      "Suppose a connector corrodes. Frames from that node fail their CRC. Its transmit error counter climbs by 8 per failure; past 127 it becomes error passive, and past 255 it goes bus off and stops transmitting entirely. The rest of the network never notices anything except that one node went quiet — which is exactly the intended behaviour for a safety-critical bus.",
    facts: [
      { key: "Detection", value: "15-bit CRC + bit monitoring + bit stuffing" },
      { key: "Confirmation", value: "ACK slot pulled dominant by any node that read it intact" },
      { key: "Escalation", value: "error active → error passive → bus off" },
      { key: "Result", value: "one node isolated; the vehicle keeps working" },
    ],
    accent: "can",
    layer: "Embedded bus",
  },
];
