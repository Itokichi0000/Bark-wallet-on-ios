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
      return `<g filter="url(#wash)" fill="${color}">${char.wash.map((d) => `<path d="${d}"/>`).join("")}</g>`;
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
