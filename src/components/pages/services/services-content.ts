// Services page copy. Everything here is a placeholder in simple English until Adil confirms it.
// CONFIRM WITH ADIL: service names, descriptions, deliverables, process steps, the full list and the CTA.
// Never add clients, numbers or awards here that the client has not given us.

export type ServiceVisual =
  | { kind: "video"; slug: string }
  | { kind: "image"; slug: string; n: number };

export type Service = {
  id: string; // anchor on the page (#cgi-films)
  title: string;
  desc: string;
  deliverables: string[];
  visual: ServiceVisual;
};

// CONFIRM WITH ADIL
export const INTRO = "CGI films, stills and VFX for car brands. One studio, from the first idea to the final frame.";

// The same four services as the home page (components/services/ServicesSection.tsx), in the same order.
// CONFIRM WITH ADIL
export const SERVICES: Service[] = [
  {
    id: "cgi-films",
    title: "CGI films",
    desc: "Full CGI films for launches, campaigns and social. We build the car, the world it drives through and every camera move, then cut, grade and finish the film.",
    deliverables: ["Launch films", "Campaign films", "Teasers and reveals", "Social cut-downs"],
    visual: { kind: "video", slug: "audi-rs5-estate" },
  },
  {
    id: "cgi-stills",
    title: "CGI stills and retouching",
    desc: "Key visuals of the car, lit, rendered and retouched down to the last reflection. Made to match the film, so the whole campaign looks like one piece.",
    deliverables: ["Key visuals", "Launch and hero stills", "Studio and location shots", "Retouching"],
    visual: { kind: "image", slug: "zeekr-launch", n: 4 },
  },
  {
    id: "vfx",
    title: "VFX and compositing",
    desc: "CGI cars and effects blended into live-action footage. We track the camera, match the light and composite every frame, so the car sits in the shot for real.",
    deliverables: ["CGI car in live action", "Camera tracking", "Light matching", "Clean-up and paint-out"],
    visual: { kind: "video", slug: "nascar" },
  },
  {
    id: "direction",
    title: "Direction and production",
    desc: "From the first idea to the final grade. We write the treatment, plan the shots, direct the film and deliver it, with one team looking after the whole job.",
    deliverables: ["Ideas and treatments", "Storyboards and previs", "Direction", "Edit and colour grade"],
    visual: { kind: "video", slug: "mclaren-endurance" },
  },
];

// "How we work": one line per step. CONFIRM WITH ADIL
export const PROCESS: { title: string; line: string }[] = [
  { title: "Brief", line: "We listen, read the brief and agree the look, the shots and the dates." },
  { title: "Look development", line: "We test light, materials and colour on the car until the look is right." },
  { title: "Build", line: "We build the car, the world around it and every camera move in CGI." },
  { title: "Render and grade", line: "Every frame is rendered, composited and graded to a finished look." },
  { title: "Delivery", line: "Masters, cut-downs and stills, in every size and format you need." },
];

// The plain full list, grouped by craft. CONFIRM WITH ADIL
export const FULL_LIST: { group: string; items: string[] }[] = [
  {
    group: "Pre-production",
    items: ["Ideas and treatments", "Storyboards", "Previs and animatics", "Look development", "Shot planning"],
  },
  {
    group: "CGI",
    items: ["Car models and materials", "Environments", "Animation", "Lighting and rendering", "Smoke, dust and water"],
  },
  {
    group: "VFX and post",
    items: ["Camera tracking", "Compositing", "Clean-up and paint-out", "Edit", "Colour grade"],
  },
  {
    group: "Stills",
    items: ["Key visuals", "CGI and photo blends", "Retouching", "Colour grading", "Print and online sizes"],
  },
  {
    group: "Delivery",
    items: ["16:9 masters", "9:16 and 1:1 social cuts", "Ultra-wide and screen formats", "Stills in every size"],
  },
];

// Closing call to action. CONFIRM WITH ADIL
export const CTA = {
  title: "Have a car to bring to life?",
  line: "Send us the brief, a date or just an idea. We will take it from there.",
};
