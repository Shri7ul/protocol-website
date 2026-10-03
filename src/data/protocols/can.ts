import { ACCENTS } from "../accents";
import type { ProtocolDefinition } from "../types";

export const can: ProtocolDefinition = {
  id: "can",
  name: "CAN",
  longName: "Controller Area Network",
  subtitle: "Differential, priority-arbitrated multi-master bus",
  layer: "Embedded Bus",
  layerId: "embedded",
  communication: "Multi-Master · Message-Oriented · Broadcast",
  purpose: "Deterministic, noise-immune communication between controllers",
  hook:
    "Every node hears every message, the most urgent message always wins the bus, and no message is ever delivered corrupted — even in an electrical noise storm.",
  intro:
    "CAN was designed for cars, where dozens of controllers must exchange safety-critical data over a cable that runs the length of a vehicle, next to motors and ignition systems. It solves the problems I²C cannot: it works over metres rather than centimetres, it survives serious electrical interference, it gives every node equal right to transmit, and it resolves conflicts by priority without losing a single frame. It is a broadcast bus — messages carry an identifier that describes their *content*, not the node that sent them.",
  accent: ACCENTS.can,

  problem: {
    headline: "A vehicle is an electrically hostile place to send data",
    detail:
      "A car has a starter motor drawing hundreds of amps, ignition coils switching kilovolts, and wiring looms running for several metres alongside all of it. A sensor reading in that environment must be trusted, because it may be feeding a braking decision. Meanwhile there is no single master: the engine controller, the transmission, the ABS unit and the dashboard all need to talk, sometimes simultaneously, and a safety message must never be delayed behind a status update.",
    failures: [
      "Electromagnetic interference corrupts bits on a single-ended wire",
      "Long cables shift ground potentials, so a 'high' at one end may not be high at the other",
      "Two nodes transmitting at once would corrupt both messages on a simple shared bus",
      "A node that fails can hold the bus permanently, taking down the whole vehicle",
      "Without priorities, a critical message can be blocked behind unimportant traffic",
      "Undetected corruption in a safety system is unacceptable, so errors must be caught, not tolerated",
    ],
  },
  solution: {
    headline: "Differential signalling, priority, and aggressive error detection",
    concepts: [
      {
        tag: "electrical",
        title: "Differential signalling on CAN_H and CAN_L",
        glyph: "differential",
        body:
          "The signal is the voltage difference between two twisted wires, not the voltage on one. Interference couples into both wires almost equally and cancels when the difference is taken. Common-mode ground shifts are rejected for the same reason — which is what makes multi-metre runs in a car possible at all.",
      },
      {
        tag: "arbitration",
        title: "Non-destructive bitwise arbitration",
        glyph: "arbitration",
        body:
          "If two nodes start transmitting together, they compare what they send with what they hear. A node that sends a recessive bit but reads dominant has lost, and immediately stops and becomes a receiver. The winning message continues without a single bit being lost — no retransmission, no delay, no corruption.",
      },
      {
        tag: "priority",
        title: "The identifier is the priority",
        glyph: "priority",
        body:
          "A numerically lower identifier wins arbitration, because dominant bits beat recessive ones and identifiers are compared from the most significant bit. Priority is therefore a property of the message content, not of the node that sends it, and every node can compute the ordering in advance — which makes the bus's timing analysable.",
      },
      {
        tag: "addressing",
        title: "Message-oriented, not node-addressed",
        glyph: "multidrop",
        body:
          "Frames are labelled by what they contain — 'engine speed', 'brake pressure' — and broadcast to everyone. Any node that cares listens; nodes that do not care ignore it. Adding a new listener costs nothing and requires no change to the sender.",
      },
      {
        tag: "integrity",
        title: "Five independent error checks",
        glyph: "checksum",
        body:
          "Bit monitoring, a 15-bit CRC, bit stuffing, a fixed-form frame check and per-frame acknowledgement, all in hardware. An error rate that would be tolerable on a home bus is unacceptable in a vehicle, so CAN is built to detect essentially every corruption — and to make a repeatedly failing node remove itself from the network.",
      },
      {
        tag: "fault tolerance",
        title: "Error counters and bus-off",
        glyph: "loss",
        body:
          "Every node keeps transmit and receive error counters. A node that causes repeated errors escalates from error active, to error passive, to bus off — disconnected from the bus without human intervention. A single broken controller cannot take down the network it shares.",
      },
      {
        tag: "robustness",
        title: "Termination resistors",
        glyph: "pullup",
        body:
          "Two 120 Ω resistors, one at each end of the bus, absorb reflections on the transmission line and give the transceivers a defined idle state. Removing one still often 'works' — until the cable gets longer, and the reflections return as intermittent errors.",
      },
    ],
  },

  mechanics: {
    headline: "How a CAN frame is transmitted",
    framing:
      "Follow one message from a brake controller. The interesting parts are the beginning — where arbitration decides who wins — and the end, where every other node acknowledges what it heard.",
    stack: [
      { label: "Application", sub: "vehicle control logic" },
      { label: "CAN controller", sub: "framing, CRC, bit stuffing", emphasis: true },
      { label: "CAN transceiver", sub: "differential signalling on CAN_H / CAN_L", emphasis: true },
      { label: "Bus", sub: "twisted pair, 120 Ω terminated at both ends" },
    ],
    steps: [
      {
        id: "idle",
        title: "Bus idle",
        summary: "Both wires sit at the same voltage — the recessive state.",
        body:
          "With no dominant signal, CAN_H and CAN_L rest at a common level, roughly 2.5 V, so their difference is near zero. This is the recessive state, read as a logical 1. Any node may start transmitting when the bus has been idle.",
        facts: [
          { key: "Recessive", value: "CAN_H ≈ CAN_L ≈ 2.5 V, difference ≈ 0 V" },
          { key: "Means", value: "logical 1" },
        ],
      },
      {
        id: "sof",
        title: "Start of Frame",
        summary: "A single dominant bit announces that a frame is beginning.",
        body:
          "One dominant bit forces the bus active. Every node on the network sees it and begins synchronising its bit timing to the falling edge of this bit. From this moment all nodes are listening, and any node with something to send is now racing to arbitrate.",
        facts: [
          { key: "SOF", value: "1 dominant bit" },
          { key: "Purpose", value: "hard synchronisation for all receivers" },
        ],
      },
      {
        id: "arbitration",
        title: "Arbitration",
        summary: "Nodes compete bit by bit; the lowest identifier wins, losslessly.",
        body:
          "Each node transmits its identifier while reading back the bus. A node sending a recessive bit that reads dominant has lost and withdraws immediately, becoming a receiver. The winner never even notices a competitor existed, and nothing needs retransmitting. Priorities are therefore deterministic and agreed in advance by the system designer, not negotiated at runtime.",
        facts: [
          { key: "Dominant", value: "logical 0 — overrides recessive" },
          { key: "Rule", value: "lower identifier value = higher priority" },
          { key: "On losing", value: "the node stops transmitting and listens" },
        ],
        sequence: {
          caption: "Three nodes arbitrate — the lowest identifier wins",
          nodes: [{ label: "Node A", sub: "ID 0x100" }, { label: "Node B", sub: "ID 0x200" }, { label: "Bus" }],
          arrows: [
            { from: 0, to: 2, label: "ID 0x100", detail: "dominant from bit 4", tone: "ok" },
            { from: 1, to: 2, label: "ID 0x200", detail: "recessive → loses, withdraws", tone: "danger", dashed: true },
            { from: 0, to: 2, label: "frame continues", detail: "not one bit lost", tone: "ok" },
          ],
        },
      },
      {
        id: "control",
        title: "Control field and DLC",
        summary: "The data length code says how many bytes follow.",
        body:
          "In classical CAN the control field carries the identifier extension flag, a reserved bit and a 4-bit data length code. The DLC can express 0 to 8 bytes, which is the payload limit that CAN FD later broke. In CAN FD the same field is reinterpreted so that values above 8 encode 12, 16, 20, 24, 32, 48 and 64 bytes.",
        facts: [
          { key: "Classical CAN", value: "0–8 data bytes" },
          { key: "CAN FD", value: "up to 64 data bytes" },
          { key: "Why DLC matters", value: "receivers must know the exact frame length to check the CRC" },
        ],
      },
      {
        id: "data",
        title: "Data and bit stuffing",
        summary: "The payload, with a stuff bit inserted after five identical bits.",
        body:
          "Data is transmitted with bit stuffing: after five consecutive bits of the same polarity, the transmitter inserts one bit of the opposite polarity, which the receiver automatically discards. This guarantees a signal edge at least every six bit times, so receivers can stay synchronised on long runs of identical bits. Stuffing costs a little bandwidth and, crucially, gives a receiver one more way to detect corruption — a stuffed bit that is not there is itself an error.",
        facts: [
          { key: "Stuff rule", value: "one opposite bit after five identical bits" },
          { key: "Benefit", value: "guaranteed edges for clock resynchronisation" },
          { key: "Side effect", value: "framing errors become detectable" },
        ],
      },
      {
        id: "crc",
        title: "CRC and acknowledgement",
        summary: "A 15-bit CRC, then every node that read it correctly pulls the bus dominant.",
        body:
          "The cyclic redundancy check covers the frame from the start of frame to the end of the data field. The transmitter then sends a recessive ACK slot: every receiver that validated the frame — regardless of whether it cares about the content — drives the bus dominant. If the transmitter reads dominant there, at least one node received the frame correctly. This is acknowledgement by *anyone*, not by the intended recipient, which is why there is no destination address on a CAN frame.",
        facts: [
          { key: "CRC", value: "15 bits, Hamming distance 6" },
          { key: "ACK slot", value: "dominant from every node that saw the frame intact" },
          { key: "After ACK", value: "ACK delimiter — the only place stuffing may be violated" },
        ],
        sequence: {
          caption: "Anyone may acknowledge",
          nodes: [{ label: "Transmitter" }, { label: "Bus" }, { label: "Other nodes" }],
          arrows: [
            { from: 0, to: 1, label: "frame + CRC", tone: "accent" },
            { from: 1, to: 0, label: "ACK slot dominant", detail: "at least one node received it", tone: "ok" },
          ],
        },
      },
      {
        id: "eof",
        title: "End of Frame",
        summary: "Seven recessive bits close the frame and force a frame check.",
        body:
          "The end-of-frame field is seven recessive bits in a row — deliberately more than the five that would trigger bit stuffing. That means a receiver that sees a sixth consecutive level inside the end-of-frame field has detected a violation, and knows the framing was broken. It is a cheap, hardware-level sanity check on the whole frame boundary.",
        facts: [
          { key: "EOF", value: "7 recessive bits" },
          { key: "Why 7", value: "exceeds the stuff limit, so a violation is detectable" },
          { key: "Then", value: "intermission — 3 bits before the next frame may start" },
        ],
      },
      {
        id: "errors",
        title: "Error handling and fault confinement",
        summary: "Counters escalate a failing node from active, to passive, to off the bus.",
        body:
          "Every node maintains a transmit error counter and a receive error counter. Errors increment them, successes decrement them. Past a threshold the node becomes error passive, and must wait an extra delay before transmitting; past a higher threshold it goes bus off and stops participating entirely until it is deliberately reset. This is fault confinement: a node with a broken transceiver or bad wiring degrades its own participation instead of corrupting the network for everyone.",
        facts: [
          { key: "Error active", value: "below 128 — may signal errors with an error frame" },
          { key: "Error passive", value: "above 127 — signals only, with extra intermission" },
          { key: "Bus off", value: "above 255 transmit errors — node disconnects itself" },
        ],
        sequence: {
          caption: "Error counting and fault confinement",
          nodes: [{ label: "Node", sub: "error counters" }, { label: "Bus", sub: "shared" }],
          arrows: [
            { from: 1, to: 0, label: "corrupted frame detected", detail: "TEC increments by 8", tone: "danger" },
            { from: 1, to: 0, label: "more errors", detail: "TEC passes 127", tone: "danger" },
            { from: 0, to: 1, label: "error passive", detail: "extra intermission, less influence", tone: "warn" },
            { from: 0, to: 1, label: "TEC passes 255 → bus off", detail: "node removes itself", tone: "warn" },
          ],
        },
      },
    ],
  },

  frame: {
    unit: "Frame (standard 11-bit or extended 29-bit identifier)",
    overhead: "47 bits minimum for a standard frame before any data",
    note:
      "A CAN frame has no destination address — the identifier names the content, and the frame is sent to everyone. Arbitration, the CRC and the acknowledgement all happen inside this single frame.",
    rows: [
      {
        label: "Framing",
        fields: [
          {
            name: "SOF",
            size: "1 bit",
            span: 1,
            tone: "accent",
            role: "Start of Frame — one dominant bit.",
            detail: "Hard-synchronises every receiver's bit timing to the frame's first falling edge.",
          },
          {
            name: "Identifier",
            size: "11 bits (or 29 in extended)",
            span: 3,
            tone: "accent",
            role: "Names the message content, and sets its priority.",
            detail:
              "Lower numeric value means dominant bits in the most significant positions, so it wins arbitration and therefore has higher priority. The 11-bit standard form allows 2048 identifiers; the 29-bit extended form allows over 500 million. Designers assign identifiers deliberately — engine speed at 0x100 will always beat a diagnostic request at 0x7DF.",
            example: "0x100 — engine RPM",
          },
          {
            name: "RTR",
            size: "1 bit",
            span: 1,
            tone: "neutral",
            role: "Remote Transmission Request.",
            detail:
              "A data frame sends dominant; a remote frame sends recessive to request that another node transmit that identifier. Remote frames are largely a historical artefact and are discouraged in modern designs, because they complicate arbitration and are unused in CAN FD.",
            example: "0 — data frame",
          },
        ],
      },
      {
        label: "Control",
        fields: [
          {
            name: "IDE",
            size: "1 bit",
            span: 1,
            tone: "neutral",
            role: "Identifier Extension — selects 11-bit or 29-bit form.",
            detail: "Dominant selects the extended 29-bit identifier; recessive selects the standard 11-bit form.",
          },
          {
            name: "r0 / FDF",
            size: "1 bit",
            span: 1,
            tone: "neutral",
            role: "Reserved in classical CAN; Frame Format in CAN FD.",
            detail:
              "In CAN FD this bit is recessive to mark an FD frame, which lets classical controllers reject FD frames as errors rather than misread them — a necessary compatibility mechanism during a gradual fleet transition.",
          },
          {
            name: "DLC",
            size: "4 bits",
            span: 1,
            tone: "ok",
            role: "Data Length Code — how many payload bytes follow.",
            detail:
              "0–8 in classical CAN. In CAN FD values 9–15 encode 12, 16, 20, 24, 32, 48 and 64 bytes; the values 9–15 are not used as byte counts directly, which is why FD payload sizes jump.",
            example: "8",
          },
        ],
      },
      {
        label: "Payload and protection",
        fields: [
          {
            name: "Data",
            size: "0–8 bytes (0–64 in CAN FD)",
            span: 3,
            role: "The message content, defined by the network's database.",
            detail:
              "Multi-byte signals are packed into the data field bit by bit, and the layout is documented in a CAN database file (DBC). A single 8-byte frame can carry a dozen unrelated signals — for example four wheel speeds at 14 bits each — which is why the payload looks opaque without the database.",
            example: "0x0C 0x80 …",
          },
          {
            name: "CRC",
            size: "15 bits (+1 delimiter)",
            span: 2,
            tone: "ok",
            role: "Cyclic redundancy check over the whole frame.",
            detail:
              "A 15-bit CRC with Hamming distance 6, chosen so that all burst errors up to 15 bits are detected, and residual error probability is vanishingly small for frames of this size. CAN FD extends the CRC to 17 or 21 bits to cover its longer payloads.",
          },
          {
            name: "ACK slot",
            size: "1 bit + delimiter",
            span: 1,
            tone: "warn",
            role: "Driven dominant by every node that received the frame correctly.",
            detail:
              "Acknowledgement is collective and content-agnostic. It confirms that *someone* on the bus validated the frame, not that the intended consumer acted on it — an important distinction when reasoning about system behaviour.",
          },
          {
            name: "EOF",
            size: "7 bits",
            span: 1,
            tone: "accent",
            role: "End of Frame — seven recessive bits.",
            detail:
              "Deliberately longer than the five-bit stuff limit, so a bit-stuffing violation inside this field is detectable as a framing error.",
          },
        ],
      },
      {
        label: "Signalling",
        fields: [
          {
            name: "CAN_H",
            size: "1 wire",
            span: 2,
            role: "Non-inverting side of the differential pair.",
            detail:
              "Driven high for a dominant bit, so that the difference between the two wires becomes a defined positive voltage — roughly 2 V for a dominant bit.",
          },
          {
            name: "CAN_L",
            size: "1 wire",
            span: 2,
            role: "Inverting side of the differential pair.",
            detail:
              "Driven low for a dominant bit. The receiver measures CAN_H − CAN_L, so noise that couples equally into both wires cancels out. This is the single most important electrical decision in CAN.",
            example: "≈ 2 V differential when dominant",
          },
          {
            name: "Termination",
            size: "2 × 120 Ω",
            span: 2,
            tone: "ok",
            role: "One resistor at each physical end of the bus.",
            detail:
              "A CAN bus is a transmission line, and the resistors match its characteristic impedance (~60 Ω when the two are seen in parallel), absorbing reflections. Both ends, not one, and never in a star — the bus must be daisy-chained.",
            example: "120 Ω at each end",
          },
        ],
      },
    ],
  },

  realWorld: {
    title: "An electric vehicle chassis bus",
    scenario:
      "Twelve controllers share one twisted pair running the length of the car. The identifiers were chosen when the vehicle was designed, and they encode the priority of every message.",
    hops: [
      {
        label: "Bus",
        sub: "one twisted pair, terminated at both ends",
        facts: [
          { key: "Bit rate", value: "500 kbit/s (classical CAN)", "": "" } as never,
        ],
      },
      {
        label: "Brake controller",
        sub: "identifier 0x080",
        facts: [
          { key: "Message", value: "brake pressure + pedal position" },
          { key: "Priority", value: "very high — low identifier wins immediately" },
          { key: "Period", value: "every 10 ms, with no jitter allowed" },
        ],
      },
      {
        label: "Motor inverter",
        sub: "identifier 0x1A0",
        facts: [
          { key: "Message", value: "torque request, rotor speed, temperature" },
          { key: "Payload", value: "8 bytes packing three 16-bit values" },
          { key: "Priority", value: "high — must beat comfort traffic, not braking" },
        ],
      },
      {
        label: "Battery management",
        sub: "identifier 0x2C0",
        facts: [
          { key: "Message", value: "pack voltage, current, cell temperatures" },
          { key: "Period", value: "every 100 ms" },
        ],
      },
      {
        label: "Body / comfort",
        sub: "identifier 0x4B0+",
        facts: [
          { key: "Messages", value: "window position, seat heating, lighting" },
          { key: "Priority", value: "lowest — designed to lose arbitration when it matters" },
          { key: "Why it still works", value: "losing arbitration costs nothing; the message simply waits for the next idle slot" },
        ],
      },
      {
        label: "Diagnostics",
        sub: "identifier 0x7DF",
        facts: [
          { key: "Standard", value: "OBD-II over ISO-TP (ISO 15765-2)" },
          { key: "Payload", value: "longer transport-protocol messages split over many frames" },
          { key: "Priority", value: "lowest — a diagnostic query must never delay braking" },
        ],
      },
    ],
    moral:
      "Priority is a design decision, not a runtime one. Because a lower identifier always wins, the designer decides in advance exactly how long a braking message can be delayed by everything else on the bus — and that number is bounded and provable, which is what makes CAN usable in a safety system. A comfort message that loses arbitration does not fail; it simply waits a few hundred microseconds for the bus to go idle again.",
  },

  comparison: {
    title: "CAN vs I²C vs UART vs RS-485",
    framing:
      "Four embedded buses with very different reach. CAN is the only one that combines multi-master operation, differential signalling over metres, and hardware-enforced priority. The others solve narrower problems.",
    columns: [
      { label: "CAN", accentToken: "--color-can", accentHex: "#e8674a", emphasis: true },
      { label: "I²C", accentToken: "--color-i2c", accentHex: "#4fc4dd" },
      { label: "UART", accentToken: "--color-i2c", accentHex: "#4fc4dd" },
      { label: "RS-485", accentToken: "--color-i2c", accentHex: "#4fc4dd" },
    ],
    rows: [
      {
        dimension: "Wires",
        cells: ["2 differential + ground", "2 single-ended + ground", "2 single-ended + ground", "2 differential + ground"],
      },
      {
        dimension: "Distance",
        cells: ["Up to ~1 km at low bit rate; 40 m at 1 Mbit/s", "Centimetres — across one board", "Metres, low speed", "Up to ~1200 m"],
      },
      {
        dimension: "Topology",
        cells: ["Linear bus, terminated at both ends", "Multi-drop bus", "Point to point", "Linear multi-drop bus"],
      },
      {
        dimension: "Multi-master",
        cells: ["Yes — every node may transmit", "Rarely — one controller in practice", "No", "Yes, but arbitration is left to software"],
      },
      {
        dimension: "Conflict resolution",
        cells: ["Hardware bitwise arbitration by identifier priority, lossless", "Arbitration exists but is almost never used", "Not applicable", "None — collisions destroy both messages"],
      },
      {
        dimension: "Addressing",
        cells: ["Message identifier, broadcast to all", "7-bit device address per transaction", "None", "Node address in software"],
      },
      {
        dimension: "Noise immunity",
        cells: ["High — differential, twisted pair", "Low — single-ended, short runs only", "Low", "High — differential"],
      },
      {
        dimension: "Error detection",
        cells: [
          "15-bit CRC, bit monitoring, bit stuffing, form check, ACK — all in hardware",
          "Optional checksum in some devices; ACK per byte only",
          "Optional parity or application checksum",
          "Software checksum only",
        ],
      },
      {
        dimension: "Fault confinement",
        cells: ["Yes — TEC/REC counters escalate to bus off", "No — a stuck device can hold the bus", "No", "No"],
      },
      {
        dimension: "Typical bit rate",
        cells: ["125 kbit/s – 1 Mbit/s (5 Mbit/s data phase in CAN FD)", "100 kHz – 3.4 MHz", "9.6 kbaud – several Mbaud", "Up to 10 Mbit/s at short range"],
      },
      {
        dimension: "Payload per frame",
        cells: ["8 bytes (64 in CAN FD)", "Unlimited, byte stream", "Unlimited, byte stream", "Unlimited, byte stream"],
      },
      {
        dimension: "Best for",
        cells: [
          "Automotive, robotics, industrial machinery — many controllers, long runs, safety-relevant timing",
          "Sensors, EEPROMs, clocks, small displays on one board",
          "Consoles, GPS and radio modules, host-to-host links",
          "Building automation, DMX lighting, industrial sensor networks",
        ],
      },
      {
        dimension: "Main weakness",
        cells: [
          "Low payload per frame and a shared bandwidth budget that must be designed",
          "Short reach and no fault tolerance",
          "No bus, no addressing, no error detection",
          "Collisions are destructive; multi-master needs a software protocol on top",
        ],
      },
    ],
  },

  recap: {
    headline: "CAN in 20 seconds",
    points: [
      "A board- and vehicle-level bus, not part of the TCP/IP stack — it exists for controllers metres apart in a noisy environment.",
      "Differential signalling on CAN_H and CAN_L rejects the interference that would destroy a single-ended signal.",
      "Every node may transmit; a lower identifier wins arbitration bit by bit, and the loser withdraws without corrupting anything.",
      "Frames are message-oriented and broadcast — the identifier names the content, not the recipient. There is no destination address.",
      "Five hardware error checks, including a 15-bit CRC and bit stuffing, plus acknowledgement by any node that received the frame intact.",
      "Error counters escalate a failing node from error active, to error passive, to bus off — fault confinement without outside intervention.",
      "Classical CAN carries 8 bytes per frame; CAN FD carries 64 and allows a faster data phase. Prioritise by design, and terminate both ends with 120 Ω.",
    ],
  },

  related: ["i2c", "udp"],

  references: [
    {
      label: "ISO 11898-1 — Road vehicles: CAN data link layer and physical signalling",
      note: "The base standard for classical CAN and CAN FD framing and arbitration.",
    },
    {
      label: "ISO 11898-2 — High-speed medium access unit",
      note: "The physical layer: differential levels, bit timing and termination.",
    },
    {
      label: "CiA 601 — CAN FD node and system design",
      note: "Practical guidance on migrating a network to CAN FD and mixing frame types.",
    },
    {
      label: "ISO 15765-2 — Transport protocol and network layer services (ISO-TP)",
      note: "How long diagnostic messages are segmented across multiple CAN frames.",
    },
  ],
};
