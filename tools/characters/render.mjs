// Draws the Choju characters – the rabbit (主役) and the frog (相棒) – in the
// style of the public-domain 鳥獣人物戯画 scrolls, and renders them into
// layered template PNGs for the app (plus the app icon).
//
// Lines are brush strokes (brush.mjs): centre lines that swell and taper
// like a sumi brush, with a dry-brush grain. Layers:
//   paper  – the white body fill
//   wash   – light ink wash (薄墨), tinted by the app
//   ink    – brush lines, solid ink and the dark ink on the ear tips
//   accent – bitcoin orange (scarf, letter seal)
//
// usage: NODE_PATH=$(npm root -g) node tools/characters/render.mjs [--preview out.png]

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { strokesToPaths } from "./brush.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "../../SatsOS/Resources/Assets.xcassets");
const PX = 1.5; // drawing units -> pixels

// ------------------------------------------------------------ stroke kinds

const contour = (d, extra = {}) => ({ d, w: 7.5, taper: [0.14, 0.32], swell: 0.3, ...extra });
const line = (d, extra = {}) => ({ d, w: 4.6, taper: [0.2, 0.4], swell: 0.25, ...extra });
const fine = (d, extra = {}) => ({ d, w: 2.4, taper: [0.25, 0.55], swell: 0.2, min: 0.1, ...extra });
const hair = (d, extra = {}) => ({ d, w: 1.3, taper: [0.05, 0.8], swell: 0, min: 0.05, wobble: 0.05, ...extra });

const ellipse = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

// ------------------------------------------------------------ the rabbit
// Walking upright like a person, as in the 甲巻: a slim body whose back
// flows into the hind leg, a small head with a long muzzle, the eye set
// high, long ears leaning back together with inked tips, few inner lines.

// the scroll's line: lighter than a cartoon outline, with a big swell
const sumi = (d, extra = {}) => ({ d, w: 5.6, taper: [0.22, 0.36], swell: 0.45, wobble: 0.15, ...extra });

const rabbitHead = {
  paper: [
    "M206 168 C 198 146, 210 128, 232 126 C 256 126, 282 140, 302 158 C 298 172, 284 180, 268 182 C 256 192, 230 194, 214 186 Z",
  ],
  strokes: [
    sumi("M234 126 C 214 124, 198 142, 204 166 C 206 174, 210 180, 214 186", { w: 5.4 }),
    sumi("M238 127 C 262 128, 286 142, 302 158", { w: 5, taper: [0.15, 0.3] }),
    line("M303 161 C 296 173, 282 180, 268 181", { w: 3.8, swell: 0.3 }),
    line("M270 181 C 260 188, 256 198, 260 210", { w: 3.6 }),
    hair("M292 162 C 308 158, 320 154, 332 148"),
    hair("M293 166 C 310 166, 322 168, 334 172"),
    hair("M291 170 C 304 176, 314 182, 322 190"),
    fine("M296 168 C 292 173, 286 175, 280 174", { w: 2.2 }),
  ],
  fills: ["M297 154 c 4 0 7 3 5 6 c -3 2 -7 1 -7 -3 z"],
};

const rabbitEyeOpen = (big = false) => ({
  strokes: [fine("M254 149 C 260 142, 270 142, 276 149", { w: 2.8, taper: [0.15, 0.35] })],
  fills: [ellipse(266, 150, big ? 4.6 : 3.6, big ? 4.2 : 3.2)],
});

const rabbitEyeHappy = {
  strokes: [fine("M253 152 C 259 142, 270 141, 277 151", { w: 3.2, taper: [0.2, 0.3] })],
  fills: [],
};

const rabbitEars = {
  paper: [
    "M222 134 C 206 98, 194 54, 196 18 C 212 46, 226 92, 232 130 Z",
    "M236 130 C 230 92, 224 50, 228 14 C 244 46, 252 90, 248 132 Z",
  ],
  wash: [
    "M218 124 C 206 94, 200 62, 200 36 C 210 62, 220 94, 226 124 Z",
    "M238 122 C 234 92, 232 62, 232 36 C 242 64, 246 94, 244 124 Z",
  ],
  // the dark ink on the ear tips, a Chōjū-giga trademark
  softInk: [
    { d: "M196 17 C 201 34, 208 50, 214 64 C 205 58, 197 40, 196 17 Z", a: 0.92 },
    { d: "M228 13 C 235 30, 240 46, 242 60 C 234 54, 228 36, 228 13 Z", a: 0.92 },
  ],
  strokes: [
    sumi("M223 134 C 206 98, 194 54, 196 17", { w: 4.6, taper: [0.12, 0.5] }),
    line("M196 17 C 212 46, 226 92, 231 128", { w: 3.4, taper: [0.5, 0.3] }),
    sumi("M237 130 C 230 92, 224 50, 228 13", { w: 4.6, taper: [0.12, 0.5] }),
    line("M228 13 C 244 46, 252 90, 248 132", { w: 3.6, taper: [0.5, 0.3] }),
  ],
};

function standingRabbit({ eyes = rabbitEyeOpen(), extra = {}, holdingStick = false } = {}) {
  // near arm swings forward, far arm back, as if walking
  const arm = holdingStick
    ? [
        line("M252 214 C 262 238, 270 258, 284 262 C 294 262, 300 254, 304 244", { w: 3.8 }),
        fine("M304 244 l 8 -2", { w: 2.2 }),
        fine("M305 250 l 8 1", { w: 2.2 }),
      ]
    : [
        line("M252 214 C 262 238, 270 258, 282 262 C 292 262, 298 252, 302 240", { w: 3.8 }),
        fine("M302 240 l 4 -9", { w: 2 }),
        fine("M302 240 l 9 -4", { w: 2 }),
        fine("M302 240 l 9 3", { w: 2 }),
      ];
  return {
    viewBox: [0, 0, 400, 480],
    paper: [
      ...rabbitEars.paper,
      ...rabbitHead.paper,
      // slim body leaning into the step
      "M212 178 C 192 214, 178 266, 180 318 C 182 346, 190 366, 200 376 L 244 352 C 256 326, 266 290, 270 252 C 272 226, 268 206, 262 196 Z",
      // rear leg pushing off, front leg stepping forward
      "M198 372 C 206 392, 204 406, 194 416 C 184 426, 174 434, 168 441 L 202 452 L 196 446 C 196 438, 200 430, 206 422 C 214 410, 216 396, 210 380 Z",
      "M240 350 C 262 362, 276 380, 276 400 C 276 416, 272 430, 268 442 C 288 444, 306 448, 322 452 C 298 452, 272 450, 248 446 C 256 414, 256 392, 236 362 Z",
      "M186 344 c -14 -2 -20 14 -8 22 c 6 4 12 0 12 -6 Z",
      ...(extra.paper ?? []),
    ],
    wash: [
      ...rabbitEars.wash,
      // light shading on the back, the far arm and the far (rear) leg
      "M206 190 C 190 224, 182 270, 184 316 C 186 338, 192 354, 198 362 C 194 330, 194 284, 200 244 C 202 220, 206 204, 212 192 Z",
      "M226 228 C 216 246, 208 264, 202 280 C 210 274, 220 256, 230 236 Z",
      "M202 378 C 206 396, 202 410, 192 422 C 184 430, 178 436, 174 440 C 186 436, 200 426, 208 412 C 214 400, 214 388, 210 378 Z",
    ],
    softInk: [...rabbitEars.softInk, ...(extra.softInk ?? [])],
    strokes: [
      ...rabbitEars.strokes,
      ...rabbitHead.strokes,
      ...eyes.strokes,
      // the back flowing down into the rump
      sumi("M214 186 C 194 218, 180 268, 180 316", { w: 6.4, swell: 0.5 }),
      sumi("M180 314 C 180 344, 188 362, 198 372", { w: 5.6 }),
      // throat, chest, belly
      sumi("M260 210 C 270 234, 270 270, 262 302 C 256 326, 248 342, 238 352", { w: 5.8, taper: [0.15, 0.3] }),
      // rear leg: thigh, knee, heel lifted, toes on the ground
      sumi("M198 372 C 206 392, 204 406, 194 416 C 184 426, 174 434, 168 441", { w: 5 }),
      line("M168 441 C 178 446, 190 450, 202 452", { w: 3.8, taper: [0.1, 0.5] }),
      line("M210 380 C 216 396, 214 410, 206 422 C 200 430, 196 438, 196 446", { w: 3.2, taper: [0.3, 0.5] }),
      // front leg: thigh line, knee, shin, the long foot forward
      line("M226 336 C 248 346, 266 366, 272 392", { w: 3.6, taper: [0.3, 0.4] }),
      sumi("M240 352 C 262 364, 276 382, 276 402 C 276 418, 272 430, 268 442", { w: 5.4 }),
      line("M252 374 C 258 394, 258 416, 250 444", { w: 3.4, taper: [0.3, 0.3] }),
      sumi("M248 446 C 272 450, 298 452, 322 452", { w: 4.6, taper: [0.1, 0.5] }),
      fine("M268 442 C 288 444, 306 447, 318 450", { w: 2.2 }),
      ...arm,
      // far arm swinging back
      line("M226 222 C 216 242, 208 258, 200 274", { w: 3.4 }),
      fine("M200 274 l -6 5", { w: 1.8 }),
      fine("M200 274 l -2 7", { w: 1.8 }),
      // tail tuft
      line("M190 342 c -15 -3 -22 14 -9 23 c 7 4 13 0 13 -7", { w: 3.4, taper: [0.2, 0.4] }),
      // a couple of fur strokes, sparingly
      fine("M236 280 q 9 4 16 1", { w: 1.8 }),
      fine("M194 236 q -4 9 -2 18", { w: 1.8 }),
      ...(extra.strokes ?? []),
    ],
    fills: [...rabbitHead.fills, ...eyes.fills, ...(extra.fills ?? [])],
    accent: extra.accent ?? [],
  };
}

// Lv.3: an orange neckerchief, knotted at the front
const scarf = {
  paper: [],
  accent: [
    "M210 178 C 228 194, 248 200, 266 198 L 268 212 C 248 216, 226 208, 208 194 Z",
    "M254 204 C 260 224, 256 244, 246 258 C 262 252, 272 232, 268 206 Z",
  ],
  strokes: [
    fine("M210 178 C 228 194, 248 200, 266 198", { w: 2.2 }),
    fine("M208 194 C 226 208, 248 216, 268 212", { w: 2.2 }),
    fine("M254 204 C 260 224, 256 244, 246 258 C 262 252, 272 232, 268 206", { w: 2 }),
  ],
};

// Lv.4: long white brows, a beard, and a walking stick in hand
const elder = {
  paper: [],
  strokes: [
    fine("M250 141 C 262 133, 276 135, 286 143", { w: 2.8 }),
    hair("M282 142 C 292 147, 298 155, 300 166", { w: 1.5 }),
    fine("M276 180 C 282 196, 276 212, 266 224", { w: 2.6 }),
    fine("M286 178 C 294 194, 292 210, 282 222", { w: 2.2 }),
    hair("M281 180 C 287 198, 284 214, 274 226", { w: 1.4 }),
    { d: "M310 222 C 312 290, 316 370, 320 452", w: 5.6, taper: [0.03, 0.08], swell: 0.05, min: 0.6 },
    line("M302 226 C 304 214, 316 212, 319 222", { w: 4.2 }),
  ],
};

// ------------------------------------------------------------ jumping rabbit

const rabbitJump = {
  viewBox: [0, 0, 400, 480],
  paper: [
    ...rabbitEars.paper,
    ...rabbitHead.paper,
    "M212 178 C 190 212, 178 262, 186 306 C 192 330, 206 340, 222 338 C 242 334, 256 312, 262 278 C 268 244, 268 214, 262 196 Z",
    "M198 322 C 212 342, 224 356, 216 370 C 210 380, 198 384, 186 388 C 198 392, 214 394, 226 396 L 222 384 C 230 370, 228 350, 214 330 Z",
    "M236 330 C 256 342, 270 356, 266 372 C 260 382, 250 388, 240 392 C 252 396, 264 398, 276 400 L 246 384 C 256 368, 246 350, 226 338 Z",
  ],
  wash: [
    ...rabbitEars.wash,
    "M206 190 C 190 222, 184 262, 190 300 C 194 318, 202 328, 210 332 C 204 306, 202 270, 206 236 C 208 216, 210 202, 214 192 Z",
    "M202 330 C 214 346, 220 358, 214 368 C 208 376, 200 380, 192 384 C 204 382, 216 376, 222 366 C 226 354, 220 340, 210 330 Z",
  ],
  softInk: [...rabbitEars.softInk],
  strokes: [
    ...rabbitEars.strokes,
    ...rabbitHead.strokes.filter((st) => !st.d.startsWith("M296 168")),
    ...rabbitEyeHappy.strokes,
    line("M297 168 C 292 178, 282 182, 272 179 C 280 186, 292 184, 297 172", { w: 2.4 }),
    sumi("M214 186 C 192 216, 180 262, 186 304", { w: 6.4, swell: 0.5 }),
    sumi("M186 302 C 192 326, 206 338, 222 338", { w: 5.4 }),
    sumi("M260 210 C 270 236, 266 276, 258 300 C 252 318, 242 330, 232 336", { w: 5.6 }),
    // arms flung up
    line("M254 214 C 276 198, 292 172, 302 136", { w: 4 }),
    fine("M302 136 l -5 -11", { w: 2.2 }),
    fine("M302 136 l 4 -12", { w: 2.2 }),
    fine("M302 136 l 11 -5", { w: 2.2 }),
    line("M224 220 C 200 204, 184 178, 176 142", { w: 4 }),
    fine("M176 142 l -10 -6", { w: 2.2 }),
    fine("M176 142 l -3 -12", { w: 2.2 }),
    fine("M176 142 l 5 -11", { w: 2.2 }),
    // legs: one kicked back, one tucked forward
    // both knees tucked up in the hop; the far leg a little lighter
    line("M198 322 C 212 342, 224 356, 216 370 C 210 380, 198 384, 186 388 C 198 392, 214 394, 226 396", { w: 4 }),
    sumi("M236 330 C 256 342, 270 356, 266 372 C 260 382, 250 388, 240 392 C 252 396, 264 398, 276 400", { w: 5 }),
    fine("M276 400 l 9 -3", { w: 2 }),
    fine("M226 396 l 8 -2", { w: 1.8 }),
    line("M190 300 c -15 -3 -22 14 -9 23 c 7 4 13 0 13 -7", { w: 3.4 }),
    hair("M150 300 C 134 302, 122 304, 110 306", { w: 1.6 }),
    hair("M156 330 C 140 334, 128 338, 118 342", { w: 1.6 }),
    hair("M300 300 C 316 302, 328 304, 340 306", { w: 1.6 }),
    hair("M196 430 C 216 434, 238 434, 258 430", { w: 1.6 }),
  ],
  fills: [...rabbitHead.fills],
  accent: [],
};

// ------------------------------------------------------------ the frog
// Side view, sitting or standing like a person, as in the scrolls: flat
// head, pointed snout, a long mouth line back under the eye, eyes bulging
// on top, inked spots on the back, long limbs with spread fingers.

const frogHead = {
  paper: [
    "M320 150 C 306 126, 276 112, 246 112 C 224 106, 200 104, 184 112 C 176 140, 196 168, 230 176 C 262 182, 300 172, 320 154 Z",
    ellipse(238, 104, 24, 22),
    ellipse(204, 100, 18, 17),
  ],
  strokes: [
    // top of the head from the snout to the near eye
    contour("M321 150 C 304 128, 280 118, 260 118", { w: 6.6, taper: [0.12, 0.3] }),
    // the eyes bulging on top
    line("M214 106 C 212 88, 224 80, 238 80 C 254 80, 264 92, 262 108", { w: 5, taper: [0.2, 0.3] }),
    fine("M188 104 C 186 90, 194 82, 204 82 C 214 82, 220 88, 220 96", { w: 3.6 }),
    // the long mouth, ending with a curl under the eye
    contour("M320 154 C 300 170, 270 178, 234 174 C 222 173, 212 169, 206 164", { w: 5.6, taper: [0.08, 0.4] }),
    fine("M206 164 c -6 -4 -6 -10 0 -12", { w: 2.4 }),
    fine("M310 141 q 3 1 4 4", { w: 3 }),
  ],
  fills: [ellipse(246, 104, 8.5, 9), ellipse(209, 99, 6, 6.5)],
};

const frogSpots = {
  // inked blots on the back, with wash around them
  fills: [
    "M150 164 c 8 -5 18 0 15 8 c -3 7 -15 7 -16 -1 z",
    "M126 214 c 7 -4 15 1 13 7 c -3 6 -13 5 -13 -1 z",
    "M172 200 c 6 -3 12 1 10 6 c -2 5 -10 4 -10 -1 z",
    "M118 258 c 6 -3 12 1 10 6 c -2 5 -10 4 -10 -1 z",
    "M196 138 c 5 -3 10 1 8 5 c -2 4 -8 3 -8 -1 z",
  ],
  wash: [
    ellipse(156, 170, 22, 16),
    ellipse(132, 220, 18, 14),
    ellipse(176, 204, 14, 10),
    ellipse(122, 262, 16, 12),
    "M112 176 C 100 210, 100 250, 112 280 C 124 288, 128 250, 130 216 C 132 192, 124 172, 112 176 Z",
  ],
};

function sittingFrog({ arms, extra = {}, viewBox = [0, 0, 400, 340] }) {
  return {
    viewBox,
    paper: [
      ...frogHead.paper,
      "M262 196 C 272 228, 268 262, 250 288 C 240 302, 226 310, 206 312 L 302 324 L 158 326 C 132 318, 108 302, 100 270 C 92 238, 98 198, 118 166 C 138 136, 166 116, 196 110 L 236 176 Z",
      ...(extra.paper ?? []),
    ],
    wash: [...frogSpots.wash, "M210 300 C 230 296, 246 284, 252 270 C 254 288, 236 304, 212 308 Z", ...(extra.wash ?? [])],
    softInk: extra.softInk ?? [],
    strokes: [
      ...frogHead.strokes,
      // throat and belly
      line("M316 160 C 306 182, 288 194, 264 198", { w: 4.6 }),
      contour("M264 198 C 272 228, 268 260, 252 286 C 242 300, 228 308, 208 310", { w: 6.8 }),
      // the hunched back
      contour("M188 112 C 152 122, 116 156, 102 206", { w: 8, swell: 0.35 }),
      contour("M102 204 C 94 240, 100 274, 122 296", { w: 7.2 }),
      // folded thigh, shin and the long foot reaching forward
      contour("M122 294 C 142 264, 188 254, 216 272 C 238 286, 240 302, 230 314", { w: 6.6 }),
      line("M230 314 C 210 320, 184 322, 160 320", { w: 4.6 }),
      line("M192 324 C 228 328, 266 326, 300 320", { w: 4.4, taper: [0.2, 0.2] }),
      fine("M300 320 l 20 -9", { w: 2.4 }),
      fine("M300 320 l 22 2", { w: 2.4 }),
      fine("M300 320 l 17 13", { w: 2.4 }),
      fine("M150 248 q 6 10 2 20", { w: 2 }),
      ...arms,
      ...(extra.strokes ?? []),
    ],
    fills: [...frogHead.fills, ...frogSpots.fills, ...(extra.fills ?? [])],
    accent: extra.accent ?? [],
  };
}

const frogArmsDown = [
  line("M246 210 C 258 236, 264 260, 268 288", { w: 4.6 }),
  fine("M268 288 l 17 2", { w: 2.4 }),
  fine("M268 288 l 13 12", { w: 2.4 }),
  fine("M268 288 l 3 16", { w: 2.4 }),
  fine("M220 218 C 224 244, 224 266, 220 290", { w: 3.6 }),
  fine("M220 290 l 10 8", { w: 2 }),
  fine("M220 290 l -2 12", { w: 2 }),
];

// Shift a path drawn with absolute commands (M L C Q) and relative ones
// (c l q a) by dx, dy, so parts can be reused in another pose.
function shift(d, dx, dy) {
  return d.replace(/([MLCQ])([^MLCQZmlcqaz]*)/g, (_, cmd, args) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const moved = nums.map((n, i) => (i % 2 === 0 ? n + dx : n + dy));
    return cmd + moved.join(" ") + " ";
  });
}
const shiftStroke = (st, dx, dy) => ({ ...st, d: shift(st.d, dx, dy) });

// standing up on its long hind legs, arms thrown up, laughing
const HX = -22;
const HY = -44;
const frogBanzai = {
  viewBox: [0, 0, 400, 400],
  paper: [
    ...frogHead.paper.map((d) => shift(d, HX, HY)),
    "M168 76 C 136 110, 122 170, 130 226 C 136 268, 160 298, 198 302 C 236 298, 256 272, 262 236 C 270 200, 278 156, 294 118 L 230 132 Z",
    "M230 284 C 268 290, 282 322, 266 352 L 246 356 C 242 332, 234 312, 216 300 Z",
    "M170 286 C 146 306, 142 340, 156 362 L 176 360 C 166 338, 170 316, 186 300 Z",
  ],
  wash: [
    ellipse(158, 150, 18, 13),
    ellipse(150, 204, 15, 11),
    ellipse(170, 246, 12, 9),
    "M150 120 C 136 166, 134 220, 148 262 C 160 270, 162 226, 162 190 C 162 156, 158 128, 150 120 Z",
  ],
  softInk: [],
  strokes: [
    // head: top line, eye bulges (laughing arcs instead of pupils), open mouth
    shiftStroke(frogHead.strokes[0], HX, HY),
    shiftStroke(frogHead.strokes[1], HX, HY),
    shiftStroke(frogHead.strokes[2], HX, HY),
    shiftStroke(frogHead.strokes[3], HX, HY),
    shiftStroke(frogHead.strokes[5], HX, HY),
    line(shift("M318 158 C 300 194, 262 204, 230 186 C 222 181, 214 174, 208 166", HX, HY), { w: 4.6 }),
    fine("M204 66 C 210 55, 224 55, 230 66", { w: 3.6 }),
    fine("M172 62 C 176 54, 186 54, 190 62", { w: 3 }),
    // body
    contour("M170 74 C 138 110, 122 168, 130 226", { w: 8, swell: 0.35 }),
    contour("M130 224 C 136 268, 160 298, 198 302", { w: 7.2 }),
    line(shift("M316 160 C 306 182, 288 194, 264 198", HX, HY), { w: 4.4 }),
    contour("M244 156 C 252 180, 266 204, 262 238 C 256 274, 234 298, 198 302", { w: 7 }),
    // arms up with spread fingers
    line("M258 182 C 288 160, 308 112, 322 64", { w: 5 }),
    fine("M322 64 l -6 -13", { w: 2.4 }),
    fine("M322 64 l 5 -14", { w: 2.4 }),
    fine("M322 64 l 13 -6", { w: 2.4 }),
    line("M168 172 C 142 150, 122 110, 112 66", { w: 5 }),
    fine("M112 66 l -12 -7", { w: 2.4 }),
    fine("M112 66 l -4 -14", { w: 2.4 }),
    fine("M112 66 l 6 -13", { w: 2.4 }),
    // long hind legs
    contour("M230 284 C 268 290, 282 322, 266 352 C 280 366, 304 372, 330 370", { w: 6.2 }),
    fine("M330 370 l 18 -7", { w: 2.4 }),
    fine("M330 370 l 19 5", { w: 2.4 }),
    contour("M172 286 C 146 306, 142 340, 156 362 C 142 372, 118 376, 94 374", { w: 6.2 }),
    fine("M94 374 l -18 -7", { w: 2.4 }),
    fine("M94 374 l -19 5", { w: 2.4 }),
    hair("M86 170 C 72 168, 60 166, 48 166", { w: 1.8 }),
    hair("M340 170 C 354 168, 366 166, 378 166", { w: 1.8 }),
  ],
  fills: [
    // the open, laughing mouth
    shift("M320 154 C 300 170, 270 178, 234 174 C 222 173, 212 169, 208 166 C 226 186, 268 200, 318 158 Z", HX, HY),
    "M150 144 c 8 -5 18 0 15 8 c -3 7 -15 7 -16 -1 z",
    "M144 200 c 7 -4 15 1 13 7 c -3 6 -13 5 -13 -1 z",
    "M166 242 c 6 -3 12 1 10 6 c -2 5 -10 4 -10 -1 z",
  ],
  accent: [],
};

const characters = {
  rabbit1: { ...standingRabbit({ eyes: rabbitEyeOpen(true) }), transform: "translate(230 452) scale(0.74) translate(-230 -452)" },
  rabbit2: standingRabbit(),
  rabbit3: standingRabbit({ extra: scarf }),
  rabbit4: standingRabbit({ extra: elder, holdingStick: true }),
  rabbitJump,
  frogSit: sittingFrog({ arms: frogArmsDown }),
  frogBanzai,
  frogLetter: sittingFrog({
    viewBox: [0, 0, 460, 340],
    arms: [
      line("M246 210 C 268 214, 292 206, 318 192", { w: 4.6 }),
      fine("M318 192 l 6 -10", { w: 2.4 }),
      fine("M318 192 l 11 -3", { w: 2.4 }),
      fine("M220 218 C 224 244, 224 266, 220 290", { w: 3.6 }),
      fine("M220 290 l 10 8", { w: 2 }),
      fine("M220 290 l -2 12", { w: 2 }),
    ],
    extra: {
      paper: ["M312 160 L 400 142 L 412 198 L 324 216 Z"],
      wash: ["M318 200 L 408 182 L 411 196 L 324 214 Z"],
      strokes: [
        line("M312 160 L 400 142 L 412 198 L 324 216 Z", { w: 3.4, taper: [0.02, 0.02], swell: 0, min: 0.7 }),
        fine("M313 163 L 360 186 L 400 145", { w: 2.4 }),
      ],
      accent: [ellipse(376, 190, 9, 9)],
    },
  }),
};

// ------------------------------------------------------------ the home scene
// Behind the rabbit's room: autumn bush clover (萩, as next to the famous
// sumo match), pampas grass, misty hills in wash, a brushed ground with
// tufts, two small birds and an orange moon. Drawn 540 wide so the card
// can crop it on any phone; the 360-wide middle (x 90..450) is what a
// phone shows. The ground sits at y 268, where the characters stand.

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

// a small pointed leaf as a filled polygon
function leaf(cx, cy, angle, len = 8, wid = 3.2) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * len / 2;
    const y = Math.sin(a) * wid / 2 * (1 - 0.35 * Math.cos(a));
    pts.push([cx + x * Math.cos(angle) - y * Math.sin(angle), cy + x * Math.sin(angle) + y * Math.cos(angle)]);
  }
  return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";
}

// one arching bush-clover branch with leaves along it
function hagiBranch(p0, p1, p2, p3, { w = 2, leaves = 7, start = 0.3, seed = 1 } = {}) {
  const d = `M${p0} C ${p1}, ${p2}, ${p3}`;
  const fills = [];
  for (let i = 0; i < leaves; i++) {
    const t = start + (i / Math.max(leaves - 1, 1)) * (0.98 - start);
    const [x, y] = bez(p0, p1, p2, p3, t);
    const [x2, y2] = bez(p0, p1, p2, p3, Math.min(t + 0.01, 1));
    const tangent = Math.atan2(y2 - y, x2 - x);
    const side = (i + seed) % 2 === 0 ? 1 : -1;
    const ang = tangent + side * 0.75;
    const off = 4.2;
    fills.push(leaf(x + Math.cos(ang) * off, y + Math.sin(ang) * off, ang, 8.5 - i * 0.4, 3.4));
  }
  return { stroke: fine(d, { w, taper: [0.08, 0.6], swell: 0.1 }), fills };
}

const sceneHome = (() => {
  const branches = [
    hagiBranch([108, 268], [112, 222], [134, 184], [176, 156], { w: 2.4, leaves: 9, seed: 0 }),
    hagiBranch([114, 268], [124, 232], [150, 206], [196, 192], { w: 2.1, leaves: 8, seed: 1 }),
    hagiBranch([102, 268], [96, 230], [102, 196], [120, 170], { w: 1.9, leaves: 7, seed: 0 }),
    hagiBranch([118, 268], [136, 248], [162, 238], [198, 236], { w: 1.8, leaves: 6, seed: 1, start: 0.4 }),
    hagiBranch([466, 268], [470, 238], [488, 214], [520, 198], { w: 1.8, leaves: 6, seed: 0 }),
  ];
  const flowers = [[176, 154], [181, 160], [196, 190], [201, 195], [120, 168], [198, 234], [519, 196]].map(([x, y]) =>
    ellipse(x, y, 2, 1.6));
  const tuft = (x, y, s = 1) => [
    fine(`M${x} ${y} q ${-3 * s} ${-10 * s} ${-9 * s} ${-16 * s}`, { w: 1.6 }),
    fine(`M${x + 2} ${y} q 0 ${-12 * s} ${2 * s} ${-20 * s}`, { w: 1.6 }),
    fine(`M${x + 4} ${y} q ${4 * s} ${-9 * s} ${10 * s} ${-13 * s}`, { w: 1.6 }),
  ];
  return {
    viewBox: [0, 0, 540, 310],
    paper: [],
    wash: [
      // misty hills: only the ridges, fading downwards
      { d: "M60 200 C 92 180, 128 170, 166 180 C 184 186, 194 192, 204 198 C 170 194, 130 190, 96 196 C 84 198, 72 200, 60 204 Z", a: 0.75 },
      { d: "M300 192 C 334 172, 376 164, 418 176 C 436 182, 452 188, 470 192 C 440 188, 410 184, 380 186 C 350 188, 324 190, 300 196 Z", a: 0.75 },
      { d: "M380 208 C 400 200, 430 196, 460 202 C 432 204, 404 206, 380 212 Z", a: 0.5 },
      // soft ground shadow
      "M20 272 C 160 266, 380 270, 520 268 C 400 280, 160 282, 20 278 Z",
    ],
    softInk: [],
    strokes: [
      // brushed ground, lifted once in the middle
      { d: "M0 268 C 70 263, 140 272, 220 266", w: 3.2, taper: [0.05, 0.4], swell: 0.2, min: 0.15 },
      { d: "M236 266 C 320 261, 420 271, 540 265", w: 3.2, taper: [0.3, 0.05], swell: 0.2, min: 0.15 },
      fine("M120 284 C 160 281, 200 285, 230 283", { w: 1.6 }),
      fine("M310 286 C 350 283, 390 287, 426 284", { w: 1.6 }),
      // tufts along the ground
      ...tuft(70, 268), ...tuft(232, 267, 0.8), ...tuft(300, 266, 0.9), ...tuft(500, 267),
      // bush clover
      ...branches.map((b) => b.stroke),
      // pampas grass at the right edge
      fine("M436 268 C 434 226, 428 192, 414 160", { w: 1.8, taper: [0.05, 0.7] }),
      fine("M442 268 C 442 232, 446 204, 456 176", { w: 1.6, taper: [0.05, 0.7] }),
      fine("M430 268 C 422 240, 410 222, 396 210", { w: 1.5, taper: [0.05, 0.7] }),
      hair("M414 160 C 410 170, 406 176, 400 180", { w: 1.4 }),
      hair("M416 164 C 416 176, 412 184, 408 190", { w: 1.4 }),
      hair("M415 162 C 422 172, 424 180, 422 188", { w: 1.4 }),
      hair("M456 176 C 452 186, 448 192, 442 196", { w: 1.3 }),
      hair("M456 178 C 460 188, 462 194, 460 202", { w: 1.3 }),
      // a far ridge line, stopping short of the grass
      hair("M300 192 C 334 172, 372 164, 400 170", { w: 1.2 }),
      // two small birds
      fine("M350 70 q 6 -6 12 0 q 6 -6 12 0", { w: 1.7, taper: [0.2, 0.2] }),
      fine("M374 92 q 4 -4 8 0 q 4 -4 8 0", { w: 1.4, taper: [0.2, 0.2] }),
    ],
    fills: [...branches.flatMap((b) => b.fills), ...flowers],
    accent: [ellipse(414, 52, 17, 17)],
  };
})();

// ------------------------------------------------------------ brush UI
// Small brushed pieces the whole app uses: a hand-drawn card frame and an
// ink-painted button (both 9-slice), a divider, the ground under the
// characters, a washi paper texture and a low strip of the scene.

let seedState = 7;
const rnd = () => {
  seedState = (seedState * 16807) % 2147483647;
  return (seedState - 1) / 2147483646;
};

const uiPieces = {
  // 120 x 120, corner radius ~22; app slices it with 26 pt caps
  "ui-frame": {
    viewBox: [0, 0, 120, 120],
    strokes: [
      { d: "M24 3.6 L 96 3 C 108 3.2, 116.6 12, 116.8 25", w: 2.6, taper: [0.04, 0.12], swell: 0.1, min: 0.5, wobble: 0.05 },
      { d: "M116.9 24 L 116.5 96 C 116.4 108, 108 116.6, 95 116.8", w: 2.4, taper: [0.04, 0.12], swell: 0.1, min: 0.5, wobble: 0.05 },
      { d: "M96 116.9 L 24 116.4 C 12.5 116.4, 3.4 108, 3.2 95", w: 2.8, taper: [0.04, 0.12], swell: 0.1, min: 0.5, wobble: 0.05 },
      { d: "M3.1 96 L 3.5 24 C 3.6 12.5, 12 3.5, 25 3.4", w: 2.5, taper: [0.04, 0.12], swell: 0.1, min: 0.5, wobble: 0.05 },
    ],
  },
  // a rounded block painted with a broad brush
  "ui-ink-button": {
    viewBox: [0, 0, 120, 120],
    solid: ["M22 2.5 L 98 2 C 110 2.2, 118 10, 118 22 L 117.6 98 C 117.6 110, 110 118, 98 118 L 22 117.8 C 10 117.8, 2.2 110, 2.4 98 L 2.6 22 C 2.6 10, 10 2.6, 22 2.5 Z"],
  },
  "ui-divider": {
    viewBox: [0, 0, 300, 8],
    strokes: [{ d: "M2 4.2 C 80 3.2, 170 5, 298 3.8", w: 2.2, taper: [0.05, 0.45], swell: 0.25, min: 0.2 }],
  },
  "ui-ground": {
    viewBox: [0, 0, 300, 24],
    strokes: [
      { d: "M4 12 C 60 8, 120 15, 180 11 C 230 8, 270 13, 296 11", w: 2.6, taper: [0.04, 0.3], swell: 0.25, min: 0.2 },
      fine("M40 19 C 60 18, 80 20, 100 19", { w: 1.2 }),
      fine("M190 20 C 210 19, 230 21, 252 20", { w: 1.2 }),
      fine("M120 12 q -2 -6 -6 -9", { w: 1.2 }),
      fine("M122 12 q 0 -7 2 -11", { w: 1.2 }),
      fine("M124 12 q 3 -5 7 -7", { w: 1.2 }),
    ],
  },
};

// washi fibres: a 200 x 200 tile of faint threads and specks
uiPieces["ui-paper"] = (() => {
  const strokes = [];
  const fills = [];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 200;
    const y = rnd() * 200;
    const len = 6 + rnd() * 18;
    const a = rnd() * Math.PI * 2;
    const bend = (rnd() - 0.5) * 8;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    const mx = (x + x2) / 2 - Math.sin(a) * bend;
    const my = (y + y2) / 2 + Math.cos(a) * bend;
    strokes.push(hair(`M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, { w: 0.5 + rnd() * 0.6, seed: i + 3 }));
  }
  for (let i = 0; i < 50; i++) fills.push(ellipse(rnd() * 200, rnd() * 200, 0.4 + rnd() * 0.8, 0.4 + rnd() * 0.6));
  return { viewBox: [0, 0, 200, 200], strokes, fills, plain: true };
})();

// a low strip of the landscape for the foot of long screens
const sceneStrip = (() => {
  const branches = [
    hagiBranch([108, 72], [110, 50], [124, 34], [150, 22], { w: 1.8, leaves: 6, seed: 0 }),
    hagiBranch([114, 72], [124, 56], [140, 46], [170, 40], { w: 1.6, leaves: 5, seed: 1 }),
    hagiBranch([104, 72], [100, 54], [104, 40], [116, 28], { w: 1.5, leaves: 4, seed: 0 }),
  ];
  return {
    viewBox: [0, 0, 540, 90],
    paper: [],
    wash: [
      { d: "M280 64 C 320 50, 370 46, 420 54 C 440 58, 456 62, 470 66 C 420 62, 340 62, 280 68 Z", a: 0.7 },
      "M20 75 C 160 70, 380 73, 520 71 C 400 82, 160 84, 20 80 Z",
    ],
    softInk: [],
    strokes: [
      { d: "M0 72 C 70 67, 140 76, 220 70", w: 2.8, taper: [0.05, 0.4], swell: 0.2, min: 0.15 },
      { d: "M236 70 C 320 65, 420 75, 540 69", w: 2.8, taper: [0.3, 0.05], swell: 0.2, min: 0.15 },
      ...branches.map((b) => b.stroke),
      fine("M436 72 C 434 56, 428 44, 418 34", { w: 1.5, taper: [0.05, 0.7] }),
      fine("M442 72 C 442 58, 446 48, 454 38", { w: 1.4, taper: [0.05, 0.7] }),
      hair("M418 34 C 414 40, 410 44, 404 46", { w: 1.2 }),
      hair("M419 36 C 422 42, 424 46, 422 52", { w: 1.2 }),
      fine("M240 72 q -3 -8 -8 -12", { w: 1.4 }),
      fine("M242 72 q 0 -9 2 -15", { w: 1.4 }),
      fine("M244 72 q 3 -7 8 -10", { w: 1.4 }),
      fine("M330 71 q -3 -7 -7 -10", { w: 1.3 }),
      fine("M332 71 q 0 -8 2 -13", { w: 1.3 }),
    ],
    fills: branches.flatMap((b) => b.fills),
    accent: [],
  };
})();

// ------------------------------------------------------------ rendering

const filters = (px) => `
  <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="9" result="grain"/>
    <feDisplacementMap in="d" in2="grain" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feGaussianBlur in="rough" stdDeviation="${0.3 / px}"/>
  </filter>
  <filter id="paper" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="3"/>
  </filter>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.4"/>
  </filter>`;

async function layerMarkup(page, char, layer, color = "#000") {
  const markup = await rawLayerMarkup(page, char, layer, color);
  return markup && char.transform ? `<g transform="${char.transform}">${markup}</g>` : markup;
}

async function rawLayerMarkup(page, char, layer, color) {
  switch (layer) {
    case "paper":
      return `<g filter="url(#paper)" fill="${color}">${char.paper.map((d) => `<path d="${d}"/>`).join("")}</g>`;
    case "wash":
      return `<g filter="url(#wash)" fill="${color}">${char.wash
        .map((w) => (typeof w === "string" ? `<path d="${w}"/>` : `<path d="${w.d}" fill-opacity="${w.a}"/>`))
        .join("")}</g>`;
    case "accent":
      return char.accent.length
        ? `<g filter="url(#paper)" fill="${color}">${char.accent.map((d) => `<path d="${d}"/>`).join("")}</g>`
        : "";
    case "ink": {
      const shapes = await strokesToPaths(page, char.strokes);
      const soft = (char.softInk ?? [])
        .map((s) => `<path d="${s.d}" fill="${color}" fill-opacity="${s.a}"/>`)
        .join("");
      return `<g filter="url(#soft)">${soft}</g>
        <g filter="url(#ink)" fill="${color}">${shapes.map((d) => `<path d="${d}"/>`).join("")}${char.fills
          .map((d) => `<path d="${d}"/>`)
          .join("")}</g>`;
    }
  }
  return "";
}

function svgDoc(char, body, scale = PX) {
  const [x, y, w, h] = char.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * scale}" height="${h * scale}"><defs>${filters(scale)}</defs>${body}</svg>`;
}

async function shoot(page, svg, w, h, transparent = true) {
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: Math.ceil(w), height: Math.ceil(h) } });
}

function writeImageSet(name, png) {
  const dir = join(assets, `${name}.imageset`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), png);
  writeFileSync(join(dir, "Contents.json"), JSON.stringify({
    images: [{ filename: `${name}.png`, idiom: "universal", scale: "3x" }],
    info: { author: "xcode", version: 1 },
    properties: { "template-rendering-intent": "template" },
  }, null, 2) + "\n");
}

const colors = { paper: "#FFFFFF", wash: "rgba(21,21,21,0.2)", ink: "#151515", accent: "#F7931A" };

async function composite(page, char, scale) {
  let body = "";
  for (const layer of ["paper", "wash", "ink", "accent"]) {
    body += await layerMarkup(page, char, layer, colors[layer]);
  }
  return svgDoc(char, body, scale);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const previewIndex = process.argv.indexOf("--preview");

const scenePreview = process.argv.indexOf("--scene");
if (scenePreview > 0) {
  // the scene with the characters standing in it, as on the home card
  const [, , w, h] = sceneHome.viewBox;
  const sceneColors = { wash: "rgba(21,21,21,0.2)", ink: "rgba(21,21,21,0.55)", accent: "#F7931A" };
  let body = "";
  for (const layer of ["wash", "ink", "accent"]) body += await layerMarkup(page, sceneHome, layer, sceneColors[layer]);
  const rabbit = (await composite(page, characters.rabbit2, 1)).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const frog = (await composite(page, characters.frogSit, 1)).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">
    <rect width="${w}" height="${h}" fill="#FFFFFF"/><defs>${filters(1)}</defs>${body}
    <svg x="190" y="80" width="158" height="190" viewBox="0 0 400 480">${rabbit}</svg>
    <g transform="translate(442 0) scale(-1 1)"><svg x="0" y="196" width="75" height="64" viewBox="0 0 400 340">${frog}</svg></g>
    <rect x="90" y="0" width="360" height="${h}" fill="none" stroke="#c00" stroke-dasharray="4 4"/>
  </svg>`;
  writeFileSync(process.argv[scenePreview + 1], await shoot(page, doc, w * 2, h * 2, false));
  await browser.close();
  process.exit(0);
}

if (previewIndex > 0) {
  // one sheet with every character on paper, for checking the drawing
  let x = 0;
  let parts = "";
  for (const char of Object.values(characters)) {
    const [, , w, h] = char.viewBox;
    const doc = await composite(page, char, 1);
    const scale = 480 / h;
    parts += `<g transform="translate(${x} 0) scale(${scale})">${doc.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`;
    x += w * scale + 20;
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="480"><rect width="100%" height="100%" fill="#F6F5F1"/>${parts}</svg>`;
  writeFileSync(process.argv[previewIndex + 1], await shoot(page, sheet, x, 480, false));
  await browser.close();
  process.exit(0);
}

for (const [name, char] of Object.entries(characters)) {
  const [, , w, h] = char.viewBox;
  for (const layer of ["paper", "wash", "ink", "accent"]) {
    const markup = await layerMarkup(page, char, layer);
    const dir = join(assets, `char-${name}-${layer}.imageset`);
    if (!markup) {
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
    writeImageSet(`char-${name}-${layer}`, await shoot(page, svgDoc(char, markup), w * PX, h * PX));
    console.log(`char-${name}-${layer}`);
  }
}

// The home scene, rendered sharper for a full-width card.
for (const layer of ["wash", "ink", "accent"]) {
  const markup = await layerMarkup(page, sceneHome, layer);
  const [, , w, h] = sceneHome.viewBox;
  writeImageSet(`scene-home-${layer}`, await shoot(page, svgDoc(sceneHome, markup, 3), w * 3, h * 3));
  console.log(`scene-home-${layer}`);
}

// The low scene strip.
for (const layer of ["wash", "ink"]) {
  const markup = await layerMarkup(page, sceneStrip, layer);
  const [, , w, h] = sceneStrip.viewBox;
  writeImageSet(`scene-strip-${layer}`, await shoot(page, svgDoc(sceneStrip, markup, 3), w * 3, h * 3));
  console.log(`scene-strip-${layer}`);
}

// Brushed UI pieces (one template layer each).
for (const [name, piece] of Object.entries(uiPieces)) {
  const [, , w, h] = piece.viewBox;
  let body = "";
  if (piece.strokes) {
    const shapes = await strokesToPaths(page, piece.strokes);
    body += `<g filter="url(#${piece.plain ? "paper" : "ink"})" fill="#000">${shapes.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  }
  if (piece.fills) body += `<g fill="#000">${piece.fills.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  if (piece.solid) body += `<g filter="url(#paper)" fill="#000">${piece.solid.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 3}" height="${h * 3}"><defs>${filters(3)}</defs>${body}</svg>`;
  writeImageSet(name, await shoot(page, doc, w * 3, h * 3));
  console.log(name);
}

// App icon: the rabbit on paper with an orange coin.
{
  const inner = (await composite(page, characters.rabbit2, 1)).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <rect width="1024" height="1024" fill="#F6F5F1"/>
    <path d="M150 872 C 380 850, 640 884, 874 862" stroke="#151515" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="800" cy="300" r="62" fill="#F7931A"/>
    <svg x="132" y="96" width="700" height="840" viewBox="0 0 400 480">${inner}</svg>
  </svg>`;
  writeFileSync(join(assets, "AppIcon.appiconset/AppIcon.png"), await shoot(page, icon, 1024, 1024, false));
  console.log("AppIcon (flatten to RGB before shipping)");
}

await browser.close();
