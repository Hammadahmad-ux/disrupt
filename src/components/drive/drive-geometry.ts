import { DRIVE_CAR } from "./car-meta";

// Geometry of the RS5 cut-out that car-meta.ts does not carry, measured off the body's alpha channel
// (lowest opaque pixel under each hub on body-1800.webp). Fractions of the car box (x of width, y of height).
//
// - The photo was shot slightly nose-down: the front tyre touches 5.75% of the height lower than the rear.
//   LEVEL_DEG rotates the car (about the front contact patch) so both tyres sit on a flat road line.
// - car-meta's tyreRadius (0.0818) came from a rim/0.71 guess and is a third too big; the real distance
//   from hub to contact patch is ~0.0616 of the car width. Rim turns = distance / (2 * PI * TYRE_R * carWidth).
export const CONTACT = {
  rear: { x: 0.1778, y: 0.9323 },
  front: { x: 0.8111, y: 0.9898 },
} as const;

export const CAR_ASPECT = DRIVE_CAR.aspect;

export const TYRE_R =
  ((CONTACT.rear.y - DRIVE_CAR.rear.cy) / CAR_ASPECT + (CONTACT.front.y - DRIVE_CAR.front.cy) / CAR_ASPECT) / 2;

export const LEVEL_DEG =
  (-Math.atan2((CONTACT.front.y - CONTACT.rear.y) / CAR_ASPECT, CONTACT.front.x - CONTACT.rear.x) * 180) / Math.PI;

/** Rim disc box inside the car box, as CSS percentages. */
export function rimBox(which: "front" | "rear") {
  const r = DRIVE_CAR[which];
  return {
    left: `${(r.cx - r.size / 2) * 100}%`,
    top: `${(r.cy - (r.size * CAR_ASPECT) / 2) * 100}%`,
    width: `${r.size * 100}%`,
  };
}
