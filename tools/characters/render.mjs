// Renders the Choju characters (rabbit and frog, drawn after the
// public-domain Chōjū-jinbutsu-giga scrolls) into layered PNGs for the app,
// plus the app icon.
//
// Each character is split into layers so SwiftUI can colour them for light
// and dark mode and animate them as one piece:
//   paper  – the white body fill
//   wash   – light ink wash (薄墨)
//   ink    – the brush lines
//   accent – bitcoin orange bits (optional)
// Every layer is rendered black on transparent and used as a template image.
//
// usage: node tools/characters/render.mjs
// (uses the preinstalled Playwright + Chromium)

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "../../SatsOS/Resources/Assets.xcassets");
const PX_PER_UNIT = 3; // 200-unit-wide rabbit -> 600 px

// ---------------------------------------------------------------- parts

const rabbitBody = {
  silhouette: `
    <path d="M93 74 C 82 48, 76 20, 86 4 C 98 16, 104 46, 102 72"/>
    <path d="M106 70 C 104 42, 110 14, 124 4 C 130 20, 120 48, 114 72"/>
    <path d="M88 108 C 72 128, 66 160, 78 186 C 90 200, 124 200, 134 186 C 142 162, 136 130, 120 110"/>
    <path d="M80 98 C 78 78, 94 68, 110 70 C 124 72, 134 80, 140 92 C 142 99, 136 104, 128 105 C 116 112, 94 114, 84 106 Z"/>`,
  wash: `
    <path d="M90 66 C 84 44, 82 26, 87 12 C 92 26, 96 46, 97 64 Z"/>
    <path d="M110 64 C 110 44, 114 26, 121 14 C 122 30, 117 48, 113 64 Z"/>
    <path d="M84 122 C 74 142, 74 166, 84 186 C 82 162, 84 140, 94 124 Z"/>
    <path d="M82 96 C 84 86, 92 80, 100 80 C 94 86, 90 94, 90 102 Z"/>`,
  pressure: `
    <g transform="translate(1.4 1)" stroke-width="1.6">
      <path d="M86 6 C 79 22, 82 46, 92 72"/>
      <path d="M124 6 C 116 18, 110 40, 107 66"/>
      <path d="M86 110 C 72 130, 68 160, 79 184"/>
      <path d="M82 100 C 80 84, 92 72, 108 72"/>
    </g>`,
  face: `
    <path d="M113 83 q 5 -3 9 0" stroke-width="3"/>
    <circle cx="118" cy="85" r="2.3" fill="#000" stroke="none"/>
    <path d="M137 91 l 3 1.4" stroke-width="3.6"/>
    <path d="M133 100 q -4 3 -9 2" stroke-width="1.6"/>
    <path d="M128 94 l 16 -5 M129 97 l 16 1 M128 100 l 13 5" stroke-width="0.9"/>`,
  limbs: `
    <path d="M118 130 C 132 136, 144 128, 152 116" stroke-width="3.2"/>
    <path d="M152 116 l 5 -4 M152 116 l 6 0 M152 116 l 4 4" stroke-width="1.8"/>
    <path d="M90 134 C 80 144, 76 154, 80 162" stroke-width="2.6"/>
    <path d="M102 150 q 4 3 8 2 M98 166 q 5 3 10 2 M112 120 q 3 2 7 1 M92 108 q 2 3 1 6" stroke-width="1.2"/>
    <path d="M88 188 C 86 204, 80 214, 62 218 L 96 220" stroke-width="3.6"/>
    <path d="M124 188 C 128 204, 134 212, 152 216 L 122 220" stroke-width="3.6"/>
    <path d="M76 166 c -11 -1 -13 12 -2 15" stroke-width="2.6"/>`,
};

function standingRabbit({ extraInk = "", extraPaper = "", accent = "", scale = 1, bigEye = false }) {
  // scale around the feet so smaller stages stand on the same ground
  const t = scale === 1 ? "" : `transform="translate(100 220) scale(${scale}) translate(-100 -220)"`;
  const face = bigEye
    ? rabbitBody.face.replace('r="2.3"', 'r="3.4"')
    : rabbitBody.face;
  return {
    viewBox: "0 0 200 240",
    paper: `<g ${t}>${rabbitBody.silhouette}${extraPaper}</g>`,
    wash: `<g ${t}>${rabbitBody.wash}</g>`,
    ink: `<g ${t} stroke-width="3.6">${rabbitBody.silhouette}${extraPaper}</g>
          <g ${t}>${rabbitBody.pressure}${face}${rabbitBody.limbs}${extraInk}</g>`,
    accent: accent ? `<g ${t}>${accent}</g>` : "",
  };
}

const characters = {
  // Lv.1 こうさぎ – small, big eye
  rabbit1: standingRabbit({ scale: 0.74, bigEye: true }),
  // Lv.2 わかうさぎ
  rabbit2: standingRabbit({}),
  // Lv.3 おとなうさぎ – orange neckerchief
  rabbit3: standingRabbit({
    accent: `<path d="M86 108 C 96 118, 116 118, 126 106 L 110 132 Z"/>`,
    extraInk: `<path d="M86 108 C 96 118, 116 118, 126 106 L 110 132 Z" stroke-width="2.2"/>`,
  }),
  // Lv.4 ちょうじゅうさぎ – long brows, beard, walking stick
  rabbit4: standingRabbit({
    extraInk: `
      <path d="M108 79 q 8 -6 17 0" stroke-width="2.6"/>
      <path d="M126 104 c 2 12 -2 22 -10 26 M132 102 c 4 12 2 22 -3 28" stroke-width="2"/>
      <path d="M156 106 L 166 228" stroke-width="3.4"/>`,
  }),
  // jumping for joy, arms up
  rabbitJump: {
    viewBox: "0 0 200 260",
    paper: `
      <path d="M92 84 C 76 58, 66 30, 72 10 C 86 22, 98 52, 101 80"/>
      <path d="M108 80 C 110 52, 122 24, 140 14 C 142 32, 128 58, 116 82"/>
      <path d="M88 116 C 72 136, 70 170, 82 194 C 96 204, 124 204, 134 190 C 142 168, 136 136, 120 118"/>
      <path d="M80 106 C 78 86, 94 76, 110 78 C 124 80, 134 88, 140 100 C 142 107, 136 112, 128 113 C 116 120, 94 122, 84 114 Z"/>`,
    wash: `
      <path d="M90 76 C 82 54, 76 34, 76 18 C 86 32, 94 54, 97 74 Z"/>
      <path d="M111 72 C 114 52, 122 34, 135 22 C 134 38, 124 56, 115 74 Z"/>
      <path d="M84 128 C 74 148, 74 172, 84 192 C 82 168, 84 146, 94 130 Z"/>`,
    ink: `
      <g stroke-width="3.6">
        <path d="M92 84 C 76 58, 66 30, 72 10 C 86 22, 98 52, 101 80"/>
        <path d="M108 80 C 110 52, 122 24, 140 14 C 142 32, 128 58, 116 82"/>
        <path d="M88 116 C 72 136, 70 170, 82 194 C 96 204, 124 204, 134 190 C 142 168, 136 136, 120 118"/>
        <path d="M80 106 C 78 86, 94 76, 110 78 C 124 80, 134 88, 140 100 C 142 107, 136 112, 128 113 C 116 120, 94 122, 84 114 Z" stroke-width="3.4"/>
      </g>
      <g transform="translate(1.4 1)" stroke-width="1.6">
        <path d="M72 12 C 68 30, 78 56, 92 82"/>
        <path d="M86 118 C 72 138, 70 168, 81 192"/>
      </g>
      <path d="M112 92 q 5 -6 10 0" stroke-width="3"/>
      <path d="M137 99 l 3 1.4" stroke-width="3.6"/>
      <path d="M134 107 q -6 6 -13 3" stroke-width="2"/>
      <path d="M128 102 l 16 -5 M129 105 l 16 1" stroke-width="0.9"/>
      <path d="M120 138 C 136 130, 148 112, 152 90" stroke-width="3.2"/>
      <path d="M152 90 l -3 -7 M152 90 l 3 -7 M152 90 l 7 -3" stroke-width="1.8"/>
      <path d="M90 140 C 72 132, 62 114, 58 92" stroke-width="3.2"/>
      <path d="M58 92 l -6 -5 M58 92 l 0 -8 M58 92 l 4 -7" stroke-width="1.8"/>
      <path d="M102 156 q 4 3 8 2 M98 172 q 5 3 10 2" stroke-width="1.2"/>
      <path d="M92 194 C 80 210, 66 216, 48 212" stroke-width="3.6"/>
      <path d="M126 194 C 138 210, 152 214, 168 206" stroke-width="3.6"/>
      <path d="M76 176 c -11 -1 -13 12 -2 15" stroke-width="2.6"/>`,
    accent: "",
  },
};

const frogBody = {
  silhouette: `
    <path d="M24 98 C 22 64, 50 48, 80 48 C 112 48, 138 64, 136 98 C 134 116, 108 124, 80 124 C 52 124, 26 116, 24 98 Z"/>
    <circle cx="56" cy="50" r="13"/>
    <circle cx="104" cy="50" r="13"/>`,
  wash: `
    <circle cx="66" cy="72" r="7"/>
    <circle cx="94" cy="66" r="6"/>
    <circle cx="82" cy="86" r="8"/>
    <circle cx="110" cy="84" r="5"/>
    <path d="M30 100 C 32 80, 44 66, 58 60 C 48 72, 42 88, 44 108 Z"/>`,
  spots: `
    <circle cx="70" cy="72" r="2.2" fill="#000" stroke="none"/>
    <circle cx="96" cy="68" r="1.8" fill="#000" stroke="none"/>
    <circle cx="86" cy="88" r="2.4" fill="#000" stroke="none"/>`,
  hind: `
    <path d="M28 104 C 10 104, 6 124, 22 130 L 8 134 M22 130 l -10 7" stroke-width="2.6"/>
    <path d="M132 104 C 150 104, 154 124, 138 130 L 152 134 M138 130 l 10 7" stroke-width="2.6"/>`,
};

function frog({ eyes, mouth, arms, extraPaper = "", extraInk = "", accent = "", viewBox = "0 0 160 140" }) {
  return {
    viewBox,
    paper: `${frogBody.silhouette}${extraPaper}`,
    wash: frogBody.wash,
    ink: `<g stroke-width="3.6">${frogBody.silhouette}</g>${eyes}${mouth}${frogBody.spots}${arms}${frogBody.hind}${extraInk}`,
    accent,
  };
}

const openEyes = `
  <path d="M42 46 q 14 -15 28 0 M90 46 q 14 -15 28 0" stroke-width="2.2"/>
  <circle cx="58" cy="52" r="4.5" fill="#000" stroke="none"/>
  <circle cx="102" cy="52" r="4.5" fill="#000" stroke="none"/>`;

characters.frogSit = frog({
  eyes: openEyes,
  mouth: `<path d="M38 88 C 58 102, 102 102, 122 88" stroke-width="2.6"/>`,
  arms: `
    <path d="M48 116 C 46 126, 40 132, 30 134 M30 134 l -7 -2 M30 134 l -5 5 M30 134 l 1 6" stroke-width="2.6"/>
    <path d="M112 116 C 114 126, 120 132, 130 134 M130 134 l 7 -2 M130 134 l 5 5 M130 134 l -1 6" stroke-width="2.6"/>`,
});

const envelope = `<g transform="rotate(-8 175 98)"><rect x="146" y="78" width="58" height="40" rx="4"/></g>`;
characters.frogLetter = frog({
  viewBox: "0 0 220 140",
  eyes: openEyes,
  mouth: `<path d="M40 88 C 60 100, 100 100, 120 88" stroke-width="2.6"/>`,
  arms: `
    <path d="M48 116 C 46 126, 40 132, 30 134 M30 134 l -7 -2 M30 134 l -5 5 M30 134 l 1 6" stroke-width="2.6"/>
    <path d="M120 100 C 132 96, 140 92, 148 90 M148 90 l 4 -6 M148 90 l 7 -2" stroke-width="2.6"/>`,
  extraPaper: envelope,
  extraInk: `<g stroke-width="2.4">${envelope}<path d="M149 82 L175 99 L201 75" transform="rotate(-8 175 98)"/></g>`,
  accent: `<circle cx="188" cy="104" r="6"/>`,
});

characters.frogBanzai = frog({
  eyes: `<path d="M49 52 q 7 -7 14 0 M97 52 q 7 -7 14 0" stroke-width="3"/>`,
  mouth: `<path d="M54 84 C 64 104, 96 104, 106 84 Z" fill="#000" stroke-width="2.4"/>`,
  arms: `
    <path d="M28 92 C 14 80, 10 64, 12 48 M12 48 l -5 -6 M12 48 l 1 -8 M12 48 l 6 -5" stroke-width="2.6"/>
    <path d="M132 92 C 146 80, 150 64, 148 48 M148 48 l 5 -6 M148 48 l -1 -8 M148 48 l -6 -5" stroke-width="2.6"/>`,
  viewBox: "0 0 160 140",
});

// ---------------------------------------------------------------- render

const filters = `
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.3"/>
  </filter>
  <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.4"/>
  </filter>`;

const layerStyle = {
  paper: `filter="url(#ink)" fill="#000" stroke="none"`,
  wash: `filter="url(#wash)" fill="#000" stroke="none"`,
  ink: `filter="url(#ink)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"`,
  accent: `filter="url(#ink)" fill="#000" stroke="none"`,
};

function svgFor(char, layers, colors) {
  const [, , w, h] = char.viewBox.split(" ").map(Number);
  const body = layers
    .filter((l) => char[l])
    .map((l) => {
      let markup = char[l];
      if (colors) markup = markup.replaceAll("#000", colors[l]);
      let style = layerStyle[l];
      if (colors) style = style.replaceAll("#000", colors[l]);
      return `<g ${style}>${markup}</g>`;
    })
    .join("");
  return {
    w, h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${char.viewBox}" width="${w * PX_PER_UNIT}" height="${h * PX_PER_UNIT}"><defs>${filters}</defs>${body}</svg>`,
  };
}

async function renderSVG(page, svg, w, h) {
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}

function writeImageSet(name, png, { template }) {
  const dir = join(assets, `${name}.imageset`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), png);
  const contents = {
    images: [{ filename: `${name}.png`, idiom: "universal", scale: "3x" }],
    info: { author: "xcode", version: 1 },
    ...(template ? { properties: { "template-rendering-intent": "template" } } : {}),
  };
  writeFileSync(join(dir, "Contents.json"), JSON.stringify(contents, null, 2) + "\n");
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [name, char] of Object.entries(characters)) {
  for (const layer of ["paper", "wash", "ink", "accent"]) {
    if (!char[layer]) continue;
    const { w, h, svg } = svgFor(char, [layer]);
    const png = await renderSVG(page, svg, w * PX_PER_UNIT, h * PX_PER_UNIT);
    writeImageSet(`char-${name}-${layer}`, png, { template: true });
    console.log(`char-${name}-${layer}`);
  }
}

// App icon: the rabbit on paper with an orange coin.
{
  const colors = { paper: "#FFFFFF", wash: "rgba(21,21,21,0.2)", ink: "#151515", accent: "#F7931A" };
  const { svg } = svgFor(characters.rabbit2, ["paper", "wash", "ink"], colors);
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <rect width="1024" height="1024" fill="#F6F5F1"/>
    <path d="M150 846 C 380 822, 640 860, 874 836" stroke="#151515" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="790" cy="300" r="62" fill="#F7931A"/>
    <svg x="212" y="120" width="600" height="720" viewBox="0 0 200 240">${inner}</svg>
  </svg>`;
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(`<html><body style="margin:0">${icon}</body></html>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  writeFileSync(join(assets, "AppIcon.appiconset/AppIcon.png"), png);
  console.log("AppIcon");
}

await browser.close();
