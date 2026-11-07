uniform float uTime;
varying vec2 vUv;

void main() {
  vec3 col = 0.5 + 0.5 * cos(uTime + vUv.xyx * 3.0 + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(col, 1.0);
}
