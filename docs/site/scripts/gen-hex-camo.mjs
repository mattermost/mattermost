#!/usr/bin/env node
/*
 * Generates a tileable hexagonal camouflage SVG, matching the Mattermost
 * brand book "Hexagonal Camouflage" pattern (denim variant, primary
 * brand background).
 *
 * Output: docs-site/static/img/patterns/hex-camo-denim.svg
 *
 * Re-run if you want to tweak the shade mix / density / cell size.
 */

import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../static/img/patterns/hex-camo-denim.svg');

// Tile dimensions. Side=9 → ~3x smaller cells than v1 (was side=24).
// Reads as fine grain / texture rather than chunky mosaic.
const SIDE = 9;
const HEX_W = 2 * SIDE;
const HEX_H = Math.sqrt(3) * SIDE;
const COL_STEP = 1.5 * SIDE;
const ROW_STEP = HEX_H;

const COLS = 8;                                         // 8 cols × 8 rows ≈ 108×125 tile
const ROWS = 8;
const TILE_W = COL_STEP * COLS;
const TILE_H = ROW_STEP * ROWS;

// Tight shade band — every cell is within a narrow window of denim-500.
// The base color matches the hero's solid bg, so most cells visually
// disappear; only the slightly-lighter cells provide the texture beat.
// No marigold / no high-contrast outliers.
const SHADES = [
  {color: '#1E325C', weight: 14}, // denim-500 (matches hero bg — invisible cells)
  {color: '#22386A', weight: 5},  // +4 lightness — faintly visible
  {color: '#172A4F', weight: 3},  // -2 lightness — adds depth shadow
];

// Stable PRNG so the SVG is deterministic and reproducible across runs.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xCAFE);

function pickShade() {
  const total = SHADES.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const s of SHADES) {
    if (r < s.weight) return s.color;
    r -= s.weight;
  }
  return SHADES[0].color;
}

function hexPath(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i;
    pts.push(`${(cx + SIDE * Math.cos(a)).toFixed(2)},${(cy + SIDE * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')}Z`;
}

const polygons = [];
// Render extra cells beyond the tile edge so the seam is hidden when tiled.
for (let col = -1; col <= COLS + 1; col++) {
  for (let row = -1; row <= ROWS + 1; row++) {
    const cx = col * COL_STEP;
    const cy = row * ROW_STEP + (col % 2 ? ROW_STEP / 2 : 0);
    polygons.push(`<path d="${hexPath(cx, cy)}" fill="${pickShade()}"/>`);
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}"
     viewBox="0 0 ${TILE_W} ${TILE_H}"
     preserveAspectRatio="xMidYMid slice">
  <defs>
    <clipPath id="tile"><rect width="${TILE_W}" height="${TILE_H}"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="${TILE_W}" height="${TILE_H}" fill="#1E325C"/>
    ${polygons.join('\n    ')}
  </g>
</svg>
`;

mkdirSync(dirname(OUT), {recursive: true});
writeFileSync(OUT, svg);
console.log(`wrote ${OUT}  (${TILE_W}×${TILE_H.toFixed(1)})`);
