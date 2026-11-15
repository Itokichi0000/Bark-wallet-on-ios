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

const rabbitHead = {
  paper: [
    "M188 196 C 180 165, 195 140, 222 139 C 250 139, 278 158, 300 183 C 293 201, 272 210, 256 210 C 245 222, 214 222, 196 214 Z",
  ],
  strokes: [
    contour("M226 139 C 200 136, 182 160, 188 192 C 190 202, 194 210, 197 214", { w: 7 }),
    contour("M230 140 C 255 142, 280 160, 300 182", { w: 6.5, taper: [0.12, 0.3] }),
    line("M301 186 C 294 200, 276 208, 258 209", { w: 5 }),
    line("M262 209 C 250 216, 246 230, 254 246", { w: 5 }),
    hair("M288 190 C 305 186, 318 182, 332 175"),
    hair("M290 194 C 308 194, 322 196, 336 199"),
    hair("M287 198 C 302 204, 314 210, 326 219"),
    fine("M262 194 q 7 5 5 12", { w: 1.8 }),
    fine("M293 197 C 289 203, 282 206, 274 205", { w: 2.6 }),
  ],
  fills: ["M296 179 c 5 0 8 3 6 7 c -3 2 -8 1 -8 -3 z"],
};

const rabbitEyeOpen = (big = false) => ({
  strokes: [fine("M246 167 C 252 159, 262 159, 269 166", { w: 3.4, taper: [0.2, 0.35] })],
  fills: [ellipse(258, 168, big ? 5.4 : 4, big ? 4.8 : 3.4)],
});

const rabbitEyeHappy = {
  strokes: [fine("M245 170 C 251 160, 262 159, 269 169", { w: 3.6, taper: [0.2, 0.3] })],
  fills: [],
};

const rabbitEars = {
  paper: [
    "M206 150 C 190 105, 178 58, 186 22 C 203 52, 215 100, 216 148 Z",
    "M228 146 C 228 100, 232 52, 242 16 C 254 52, 250 104, 242 150 Z",
  ],
  wash: [
    "M200 140 C 190 105, 184 70, 188 40 C 198 70, 206 105, 208 140 Z",
    "M234 140 C 234 105, 238 70, 243 40 C 248 75, 246 108, 240 142 Z",
  ],
  // the dark ink on the ear tips, a Chōjū-giga trademark
  softInk: [
    { d: "M186 21 C 191 40, 199 58, 207 74 C 197 68, 188 48, 186 21 Z", a: 0.9 },
    { d: "M242 15 C 249 34, 252 54, 250 70 C 243 62, 239 40, 242 15 Z", a: 0.9 },
  ],
  strokes: [
    contour("M207 150 C 192 108, 179 62, 186 21", { w: 6, taper: [0.1, 0.45] }),
    line("M186 21 C 202 52, 213 98, 215 140", { w: 4.5, taper: [0.45, 0.3] }),
    contour("M229 145 C 229 100, 232 54, 242 15", { w: 6, taper: [0.1, 0.45] }),
    line("M242 15 C 255 52, 251 104, 243 147", { w: 4.8, taper: [0.45, 0.3] }),
  ],
};

function standingRabbit({ eyes = rabbitEyeOpen(), extra = {}, holdingStick = false } = {}) {
  const arm = holdingStick
    ? [
        line("M242 252 C 260 278, 272 292, 286 290 C 298 287, 306 270, 313 252", { w: 5 }),
        fine("M313 252 l 8 -3", { w: 2.4 }),
        fine("M314 258 l 8 0", { w: 2.4 }),
      ]
    : [
        line("M242 252 C 260 278, 270 296, 280 300 C 292 298, 300 282, 307 262", { w: 5 }),
        fine("M307 262 l 6 -10", { w: 2.4 }),
        fine("M307 262 l 10 -4", { w: 2.4 }),
        fine("M307 262 l 9 4", { w: 2.4 }),
      ];
  return {
    viewBox: [0, 0, 400, 480],
    paper: [
      ...rabbitEars.paper,
      ...rabbitHead.paper,
      "M190 205 C 165 245, 145 300, 150 350 C 152 385, 170 405, 215 408 C 240 405, 262 375, 266 320 C 268 280, 260 245, 250 228 Z",
      "M228 400 C 236 425, 230 440, 222 447 L 306 450 C 290 440, 262 432, 246 400 Z",
      "M185 398 C 182 425, 170 440, 160 447 L 232 452 C 220 440, 205 430, 205 400 Z",
      "M152 360 c -14 -2 -20 14 -8 22 c 6 4 12 0 12 -6 Z",
      ...(extra.paper ?? []),
    ],
    wash: [
      ...rabbitEars.wash,
      "M188 222 C 168 256, 158 300, 160 346 C 164 372, 172 388, 180 396 C 174 366, 172 322, 180 280 C 184 256, 190 238, 196 224 Z",
      "M258 210 C 248 222, 248 236, 256 248 C 262 236, 266 222, 262 210 Z",
      "M170 340 C 196 344, 214 362, 222 392 C 205 386, 190 372, 172 360 Z",
      "M232 404 C 240 424, 236 438, 228 446 C 252 446, 278 444, 296 446 C 276 438, 258 428, 244 404 Z",
    ],
    softInk: [...rabbitEars.softInk, ...(extra.softInk ?? [])],
    strokes: [
      ...rabbitEars.strokes,
      ...rabbitHead.strokes,
      ...eyes.strokes,
      contour("M196 212 C 176 240, 154 280, 150 320", { w: 8, taper: [0.15, 0.25], swell: 0.35 }),
      contour("M150 318 C 146 360, 158 388, 178 402", { w: 7.5 }),
      contour("M254 246 C 271 276, 270 330, 254 372 C 246 391, 234 402, 214 407", { w: 7.5, taper: [0.1, 0.35] }),
      line("M168 336 C 196 338, 220 360, 228 396", { w: 5, taper: [0.3, 0.45] }),
      contour("M229 398 C 237 420, 233 437, 222 446 C 246 449, 282 446, 307 450", { w: 6.5, taper: [0.1, 0.4] }),
      fine("M246 404 C 262 428, 284 438, 300 444", { w: 3 }),
      contour("M186 401 C 181 421, 173 437, 160 446 C 186 449, 212 451, 234 452", { w: 5.8 }),
      ...arm,
      line("M204 262 C 192 285, 188 306, 196 324", { w: 4.5 }),
      fine("M196 324 l 7 4", { w: 2.2 }),
      line("M156 358 c -15 -3 -22 14 -9 23 c 7 4 13 0 13 -7", { w: 4, taper: [0.2, 0.4] }),
      fine("M226 300 q 9 5 18 2", { w: 2.1 }),
      fine("M220 332 q 11 6 22 3", { w: 2.1 }),
      fine("M178 262 q -5 9 -3 18", { w: 2.1 }),
      fine("M168 300 q -4 8 -2 16", { w: 2.1 }),
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
    "M193 209 C 214 226, 240 236, 261 236 L 263 251 C 238 253, 211 243, 191 226 Z",
    "M246 241 C 252 262, 248 284, 236 300 C 254 293, 265 270, 261 245 Z",
  ],
  strokes: [
    fine("M193 209 C 214 226, 240 236, 261 236", { w: 2.6 }),
    fine("M191 226 C 211 243, 238 253, 263 251", { w: 2.6 }),
    fine("M246 241 C 252 262, 248 284, 236 300 C 254 293, 265 270, 261 245", { w: 2.4 }),
  ],
};

// Lv.4: long white brows, a beard, and a walking stick
const elder = {
  paper: [],
  strokes: [
    fine("M242 158 C 254 149, 270 151, 282 160", { w: 3.2 }),
    hair("M278 158 C 290 163, 298 172, 302 184", { w: 1.6 }),
    fine("M270 207 C 276 224, 270 242, 260 256", { w: 3 }),
    fine("M282 205 C 290 222, 288 240, 278 254", { w: 2.4 }),
    hair("M276 206 C 282 226, 280 244, 270 258", { w: 1.6 }),
    { d: "M318 232 C 320 300, 324 380, 330 452", w: 6.5, taper: [0.03, 0.08], swell: 0.05, min: 0.6 },
    line("M309 236 C 312 224, 324 223, 327 234", { w: 5 }),
  ],
};

// ------------------------------------------------------------ jumping rabbit

const rabbitJump = {
  viewBox: [0, 0, 400, 480],
  paper: [
    "M200 150 C 176 112, 160 66, 162 26 C 182 56, 204 100, 212 146 Z",
    "M226 144 C 230 98, 244 56, 262 24 C 268 62, 254 106, 240 148 Z",
    ...rabbitHead.paper,
    "M192 208 C 168 246, 156 300, 164 346 C 170 378, 190 394, 220 394 C 246 390, 262 360, 264 316 C 266 276, 258 244, 250 226 Z",
    "M182 372 C 168 400, 150 418, 124 426 L 120 438 C 152 434, 182 414, 200 384 Z",
    "M240 380 C 256 408, 278 424, 306 428 L 310 440 C 276 440, 248 422, 228 392 Z",
  ],
  wash: [
    "M196 140 C 178 106, 168 72, 168 44 C 182 72, 198 104, 206 138 Z",
    "M232 138 C 236 104, 246 72, 258 46 C 258 78, 248 110, 238 140 Z",
    "M194 216 C 172 252, 162 300, 168 344 C 174 370, 186 384, 198 390 C 184 360, 180 316, 188 272 C 192 248, 198 228, 202 218 Z",
    "M258 210 C 248 222, 248 236, 256 248 C 262 236, 266 222, 262 210 Z",
  ],
  softInk: [
    { d: "M162 25 C 170 44, 182 62, 194 78 C 182 72, 166 52, 162 25 Z", a: 0.9 },
    { d: "M262 23 C 264 44, 262 62, 256 78 C 252 68, 254 44, 262 23 Z", a: 0.9 },
  ],
  strokes: [
    contour("M201 150 C 176 112, 160 66, 162 25", { w: 6, taper: [0.1, 0.45] }),
    line("M162 25 C 182 56, 204 100, 211 140", { w: 4.5, taper: [0.45, 0.3] }),
    contour("M227 144 C 230 98, 244 56, 262 23", { w: 6, taper: [0.1, 0.45] }),
    line("M262 23 C 268 62, 254 106, 241 146", { w: 4.8, taper: [0.45, 0.3] }),
    ...rabbitHead.strokes.filter((s) => !s.d.startsWith("M293 197")),
    ...rabbitEyeHappy.strokes,
    line("M291 196 C 286 207, 273 212, 262 207 C 270 214, 284 213, 291 200", { w: 2.8 }),
    contour("M196 212 C 174 244, 160 296, 164 340", { w: 8, swell: 0.35 }),
    contour("M164 338 C 167 372, 186 392, 214 395", { w: 7 }),
    contour("M254 246 C 270 276, 268 326, 256 358 C 248 380, 236 392, 216 395", { w: 7.5 }),
    line("M252 258 C 284 246, 312 220, 328 178", { w: 5.4 }),
    fine("M328 178 l -4 -12", { w: 2.4 }),
    fine("M328 178 l 5 -11", { w: 2.4 }),
    fine("M328 178 l 11 -4", { w: 2.4 }),
    line("M200 258 C 170 246, 144 222, 130 182", { w: 5.4 }),
    fine("M130 182 l -10 -6", { w: 2.4 }),
    fine("M130 182 l -4 -12", { w: 2.4 }),
    fine("M130 182 l 5 -12", { w: 2.4 }),
    contour("M184 374 C 170 402, 152 420, 124 428 C 114 432, 112 439, 122 441", { w: 6.2 }),
    contour("M238 382 C 254 408, 276 424, 306 430 C 316 432, 318 439, 308 441", { w: 6.2 }),
    line("M168 338 c -15 -3 -22 14 -9 23 c 7 4 13 0 13 -7", { w: 4 }),
    fine("M226 296 q 9 5 18 2", { w: 2.1 }),
    fine("M220 326 q 11 6 22 3", { w: 2.1 }),
    fine("M182 262 q -5 9 -3 18", { w: 2.1 }),
    hair("M120 300 C 104 302, 92 304, 80 306", { w: 1.8 }),
    hair("M126 330 C 110 334, 98 338, 88 342", { w: 1.8 }),
    hair("M300 300 C 316 302, 328 304, 340 306", { w: 1.8 }),
  ],
  fills: [...rabbitHead.fills],
  accent: [],
};

// ------------------------------------------------------------ the frog

const frogBody = {
  paper: [
    "M92 262 C 82 192, 128 132, 200 130 C 272 132, 318 192, 308 262 C 304 298, 262 312, 200 312 C 138 312, 96 298, 92 262 Z",
    ellipse(146, 116, 40, 37),
    ellipse(254, 116, 40, 37),
  ],
  wash: [
    "M110 190 C 100 220, 100 250, 110 280 C 120 286, 122 256, 124 228 C 126 204, 120 186, 110 190 Z",
    ellipse(134, 182, 12, 9),
    ellipse(270, 186, 12, 9),
    ellipse(137, 242, 10, 8),
    "M128 292 C 166 306, 234 306, 272 292 C 244 302, 156 302, 128 292 Z",
  ],
  strokes: [
    contour("M110 136 C 96 160, 88 190, 90 222 C 90 246, 94 266, 104 282", { w: 8 }),
    contour("M290 136 C 304 160, 312 190, 310 222 C 310 246, 306 266, 296 282", { w: 8 }),
    line("M182 110 C 194 106, 206 106, 218 110", { w: 4.2, taper: [0.3, 0.3] }),
    contour("M104 288 C 140 312, 260 312, 296 288", { w: 6.4, taper: [0.2, 0.2] }),
    line("M107 126 C 100 96, 120 79, 146 79 C 172 79, 188 96, 184 122", { w: 5.6, taper: [0.2, 0.25] }),
    line("M216 122 C 212 96, 228 79, 254 79 C 280 79, 300 96, 293 126", { w: 5.6, taper: [0.2, 0.25] }),
    fine("M188 158 q 2 4 0 6", { w: 3 }),
    fine("M212 158 q -2 4 0 6", { w: 3 }),
  ],
  fills: [],
};

const frogHindLegs = [
  contour("M96 256 C 58 252, 42 286, 62 304 C 80 316, 104 316, 122 310", { w: 6 }),
  fine("M62 304 l -24 6", { w: 2.6 }),
  fine("M62 304 l -20 16", { w: 2.6 }),
  fine("M62 304 l -7 21", { w: 2.6 }),
  contour("M304 256 C 342 252, 358 286, 338 304 C 320 316, 296 316, 278 310", { w: 6 }),
  fine("M338 304 l 24 6", { w: 2.6 }),
  fine("M338 304 l 20 16", { w: 2.6 }),
  fine("M338 304 l 7 21", { w: 2.6 }),
];

const frogHindPaper = [
  "M96 256 C 58 252, 42 286, 62 304 C 80 316, 104 316, 122 310 L 118 274 Z",
  "M304 256 C 342 252, 358 286, 338 304 C 320 316, 296 316, 278 310 L 282 274 Z",
];

const frogEyesOpen = {
  strokes: [
  ],
  fills: [ellipse(154, 112, 11, 12), ellipse(246, 112, 11, 12)],
};

const frogFrontArmsDown = [
  line("M146 290 C 140 306, 130 318, 116 326", { w: 4.6 }),
  fine("M116 326 l -15 -2", { w: 2.4 }),
  fine("M116 326 l -11 9", { w: 2.4 }),
  fine("M116 326 l -2 13", { w: 2.4 }),
  line("M254 290 C 260 306, 270 318, 284 326", { w: 4.6 }),
  fine("M284 326 l 15 -2", { w: 2.4 }),
  fine("M284 326 l 11 9", { w: 2.4 }),
  fine("M284 326 l 2 13", { w: 2.4 }),
];

function frog({ eyes, mouth, arms, viewBox = [0, 0, 400, 340], extra = {} }) {
  return {
    viewBox,
    paper: [...frogBody.paper, ...frogHindPaper, ...(extra.paper ?? [])],
    wash: [...frogBody.wash, ...(extra.wash ?? [])],
    softInk: extra.softInk ?? [],
    strokes: [...frogBody.strokes, ...frogHindLegs, ...eyes.strokes, ...mouth.strokes, ...arms, ...(extra.strokes ?? [])],
    fills: [...frogBody.fills, ...eyes.fills, ...mouth.fills, ...(extra.fills ?? [])],
    accent: extra.accent ?? [],
  };
}

const smile = {
  strokes: [
    line("M118 204 C 154 230, 246 230, 282 204", { w: 4.8, taper: [0.15, 0.15] }),
    fine("M118 204 c -7 -2 -11 2 -11 7", { w: 2.4 }),
    fine("M282 204 c 7 -2 11 2 11 7", { w: 2.4 }),
  ],
  fills: [],
};

const characters = {
  rabbit1: { ...standingRabbit({ eyes: rabbitEyeOpen(true) }), transform: "translate(230 452) scale(0.74) translate(-230 -452)" },
  rabbit2: standingRabbit(),
  rabbit3: standingRabbit({ extra: scarf }),
  rabbit4: standingRabbit({ extra: elder, holdingStick: true }),
  rabbitJump,
  frogSit: frog({ eyes: frogEyesOpen, mouth: smile, arms: frogFrontArmsDown }),
  frogBanzai: frog({
    viewBox: [0, -20, 400, 360],
    eyes: {
      strokes: [
        line("M124 116 C 134 98, 164 96, 176 114", { w: 4.4 }),
        line("M224 114 C 236 96, 266 98, 276 116", { w: 4.4 }),
      ],
      fills: [],
    },
    mouth: {
      strokes: [line("M134 204 C 156 246, 244 246, 266 204", { w: 4 })],
      fills: ["M134 204 C 156 246, 244 246, 266 204 C 236 216, 164 216, 134 204 Z"],
    },
    arms: [
      line("M112 236 C 88 204, 74 164, 70 116", { w: 4.8 }),
      fine("M70 116 l -11 -10", { w: 2.4 }),
      fine("M70 116 l -1 -15", { w: 2.4 }),
      fine("M70 116 l 10 -11", { w: 2.4 }),
      line("M288 236 C 312 204, 326 164, 330 116", { w: 4.8 }),
      fine("M330 116 l 11 -10", { w: 2.4 }),
      fine("M330 116 l 1 -15", { w: 2.4 }),
      fine("M330 116 l -10 -11", { w: 2.4 }),
    ],
  }),
  frogLetter: frog({
    viewBox: [0, 0, 480, 340],
    eyes: frogEyesOpen,
    mouth: smile,
    arms: [
      line("M146 290 C 140 306, 130 318, 116 326", { w: 4.6 }),
      fine("M116 326 l -15 -2", { w: 2.4 }),
      fine("M116 326 l -11 9", { w: 2.4 }),
      fine("M116 326 l -2 13", { w: 2.4 }),
      line("M300 252 C 322 248, 340 240, 362 230", { w: 4.6 }),
      fine("M362 228 l 6 -9", { w: 2.4 }),
      fine("M362 228 l 10 -2", { w: 2.4 }),
    ],
    extra: {
      paper: ["M356 196 L 446 178 L 456 236 L 366 254 Z"],
      wash: ["M362 238 L 452 220 L 455 234 L 366 252 Z"],
      strokes: [
        line("M356 196 L 446 178 L 456 236 L 366 254 Z", { w: 3.4, taper: [0.02, 0.02], swell: 0, min: 0.7 }),
        fine("M357 199 L 404 222 L 446 181", { w: 2.4 }),
      ],
      accent: [ellipse(420, 226, 9, 9)],
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
