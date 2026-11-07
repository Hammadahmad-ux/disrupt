// Hero video layer: the showreel through a thin "wet glass" film that the cursor disturbs.
// Deliberately subtle (the hero copy sits on top): a small refraction along the flow, a light smear on fast
// strokes, and a faint edge lift. No colour split, no revealed layer, no idle motion.
precision highp float;

uniform sampler2D uVideo;
uniform sampler2D uPaint;
uniform vec2 uResolution; // canvas px
uniform vec2 uVideoSize;  // video px
varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  float rs = uResolution.x / uResolution.y;
  float rv = uVideoSize.x / uVideoSize.y;
  // Landscape screens show the whole picture with black bars, never cropped (Adil, 2026-11-06); phones keep cover.
  if (rs > 1.25) {
    vec2 fit = rs > rv ? vec2(rs / rv, 1.0) : vec2(1.0, rv / rs);
    return (uv - 0.5) * fit + 0.5;
  }
  vec2 scale = rs > rv ? vec2(1.0, rv / rs) : vec2(rs / rv, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

vec3 video(vec2 uv) {
  vec2 c = coverUv(uv);
  if (c.x < 0.0 || c.y < 0.0 || c.x > 1.0 || c.y > 1.0) return vec3(0.0);
  return texture2D(uVideo, c).rgb;
}

void main() {
  vec2 vel = texture2D(uPaint, vUv).rg;
  float speed = length(vel);

  vec2 shift = vel * 0.006;
  float len = length(shift);
  if (len > 0.0055) shift *= 0.0055 / len; // at most ~8 px at 1440 wide
  vec2 uv = vUv - shift;

  vec3 color;
  if (speed < 0.003) {
    color = video(uv);
  } else {
    // Light 5-tap smear along the flow, like water dragging across glass.
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 5; i++) acc += video(uv + vel * 0.006 * (float(i) / 4.0 - 0.5));
    color = acc / 5.0;
  }

  // Light catching the edge of the water film (at most +4%).
  color += vec3(0.04) * smoothstep(0.0, 0.5, speed);

  gl_FragColor = vec4(color, 1.0);
}
