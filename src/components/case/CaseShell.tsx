import type { CSSProperties } from "react";
import { getCase, type CaseData } from "@/content/cases";
import CaseHero from "@/components/work/CaseHero";
import { TEMPLATES } from "./registry";
import LightsDownPlayer from "./shared/LightsDownPlayer";
import { Credits } from "./shared/Credits";
import { NextProject } from "./shared/NextProject";
import CaseBackdrop from "./shared/CaseBackdrop";
import { withLqip } from "./shared/lqip";
import c from "./shared/case.module.css";

// One case study: CaseHero (the work layout's film stage keeps playing behind it, so the roster's
// fly-through lands on the same shot) → the template body for the project type (registry.ts) → Credits →
// NextProject ("keep scrolling to paint the next name"). Films also get the lights-down player.
// The root carries the project's key colour (--key, --key-ui, --key-avg), body surface and accent placement.
// Every picture gets a blurred stand-in (lqip.ts): the page's own set, and the neighbours' covers.
export default function CaseShell({ data: raw }: { data: CaseData }) {
  const data = withLqip(raw);
  const next = withLqip(getCase(raw.next)!, ["poster", "stills/01"]);
  const prev = withLqip(getCase(raw.prev)!, ["poster", "stills/01"]);
  const T = TEMPLATES[data.type];
  const Layer = T.HeroLayer;
  const props = { data, prev, next };
  return (
    <div
      className={c.shell}
      data-type={data.type}
      data-accent={data.layout.accent}
      data-surface={data.layout.surface}
      style={{ "--key": data.key, "--key-ui": data.keyUi, "--key-avg": data.keyAvg } as CSSProperties}
    >
      <CaseHero data={data} layer={Layer ? <Layer {...props} /> : null} />
      <div className={c.body}>
        <CaseBackdrop surface={data.layout.surface} />
        <T.Body {...props} />
        <Credits slug={data.slug} groups={data.credits} />
        <NextProject data={data} next={next} prev={prev} />
      </div>
      {data.film ? <LightsDownPlayer data={data} /> : null}
    </div>
  );
}
