"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ReactLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Mesh, ShaderMaterial } from "three";
import fragmentShader from "./check.frag";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function Box() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  useFrame((state, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.6;
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}

export default function StackCheck() {
  const label = useRef<HTMLParagraphElement>(null);
  useGSAP(() => {
    gsap.from(label.current, { y: 24, opacity: 0, duration: 1, ease: "power3.out" });
  });

  return (
    <ReactLenis root>
      <section style={{ height: "100vh" }}>
        <Canvas camera={{ position: [0, 0, 4] }}>
          <Box />
        </Canvas>
      </section>
      <p ref={label} style={{ padding: 32, fontSize: 14 }} data-testid="stack-ok">
        R3F + GLSL raw import + GSAP + Lenis are running.
      </p>
      <div style={{ height: "150vh" }} />
    </ReactLenis>
  );
}
