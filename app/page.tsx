import { ComparisonMatrix } from "@/components/landing/comparison-matrix";
import { FinalRecap } from "@/components/landing/final-recap";
import { Foundations } from "@/components/landing/foundations";
import { Hero } from "@/components/landing/hero";
import { ProtocolUniverse } from "@/components/landing/protocol-universe";
import { TraceVisualizer } from "@/components/landing/trace-visualizer";
import { Section, SectionHeading } from "@/components/shell/section";
import { robotStages, webRequestStages } from "@/data/traces";

/**
 * The landing page.
 *
 * Section order follows the brief: hero, foundations, the protocol universe,
 * then the two guided traces, then the comparison matrix, then the closing
 * recap. The six individual protocol pages are reached from the orbit — they
 * are not repeated as full sections here, because each one is a seven-slide
 * presentation of its own.
 */
export default function HomePage() {
  return (
    <>
      {/* 01 — Hero */}
      <Hero />

      {/* 02 — The Networking Foundations */}
      <Foundations />

      {/* 03 — Protocol Universe */}
      <Section id="universe">
        <SectionHeading
          marker="03"
          label="The protocol universe"
          title="Six protocols, two worlds"
          lead="Four of these are layers in a stack that moves data between computers. Two are buses that move data inside a single machine. Select a node — or use the index below — to open its presentation."
        />
        <ProtocolUniverse />
      </Section>

      {/* 10 — Trace a Web Request */}
      <Section id="trace" className="atlas-grid">
        <SectionHeading
          marker="10"
          label="Trace a request"
          title="Follow one URL all the way to the pixels"
          lead="Type a name, and eight stages happen in order — a naming system and five protocols, each with its own job. Select any stage to see the concrete values on the wire at that moment."
          accentHex="#4cc98a"
        />
        <TraceVisualizer stages={webRequestStages} autoPlay />
      </Section>

      {/* 11 — Trace a Robot */}
      <Section id="robot">
        <SectionHeading
          marker="11"
          label="Trace a robot"
          title="Why different protocols exist"
          lead="A single 1 kHz control loop touches both embedded buses, and each one was chosen for a different constraint. Watch a control cycle cross I²C and CAN — and see what happens when a connector corrodes."
          accentHex="#e8674a"
        />
        <TraceVisualizer stages={robotStages} compact />
      </Section>

      {/* 12 — Comparison matrix */}
      <Section id="compare">
        <SectionHeading
          marker="12"
          label="Comparison matrix"
          title="All six, side by side"
          lead="Twelve dimensions across six protocols. Hover or select any row to see why that dimension is the one that decides the design."
        />
        <ComparisonMatrix />
      </Section>

      {/* 13 — What did you learn */}
      <FinalRecap />
    </>
  );
}
