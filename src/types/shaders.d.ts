// Shader files are imported as strings (turbopack rule `type: "raw"` in next.config.ts).
declare module "*.glsl" {
  const source: string;
  export default source;
}
declare module "*.vert" {
  const source: string;
  export default source;
}
declare module "*.frag" {
  const source: string;
  export default source;
}
