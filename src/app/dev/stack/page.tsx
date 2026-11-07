import { notFound } from "next/navigation";
import StackCheck from "./stack-check";

// Dev-only smoke test: R3F + raw GLSL import + GSAP + Lenis. Hidden in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StackCheck />;
}
