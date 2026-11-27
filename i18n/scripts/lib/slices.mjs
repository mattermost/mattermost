// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A locale's work, cut into slices a translator can hold at once, for
// translators who work side by side. A slice never splits a feature, the keys
// that share a surface and the first two segments of their name, unless the
// feature alone is too big for one: the strings of one screen are worded by one
// translator, so the same concept is worded the same way.
import fs from 'fs';
import path from 'path';

import {SURFACES} from './catalogs.mjs';
import {readJSON, writeJSON} from './workdir.mjs';

// About 40,000 tokens of worklist JSON, some 100 items with their hints: room
// for a translator to read its slice, the brief and the catalog it matches,
// and to write its answers. A normal month is one slice per locale.
export const SLICE_BUDGET = 150000;

const featureOf = (surface, k) => `${surface}:${k.split('.').slice(0, 2).join('.')}`;
const sizeOf = (k, item) => k.length + JSON.stringify(item).length;

/**
 * items, {surface: {key: item}}, in slices of at most budget each, in order:
 * [{surface: {key: item}}, ...]. A surface with nothing in a slice is left out.
 */
export function cut(items, budget = SLICE_BUDGET) {
    const byFeature = new Map();
    for (const surface of Object.keys(SURFACES)) {
        for (const [k, item] of Object.entries(items[surface] || {})) {
            const id = featureOf(surface, k);
            if (!byFeature.has(id)) {
                byFeature.set(id, {entries: [], size: 0});
            }
            const f = byFeature.get(id);
            f.entries.push([surface, k, item]);
            f.size += sizeOf(k, item);
        }
    }
    const features = [...byFeature.values()];

    const slices = [];
    let current = [];
    let size = 0;
    const flush = () => {
        if (current.length) {
            slices.push(current);
        }
        current = [];
        size = 0;
    };
    for (const f of features) {
        if (f.size > budget) {
            flush();
            for (const entry of f.entries) {
                const s = sizeOf(entry[1], entry[2]);
                if (size + s > budget) {
                    flush();
                }
                current.push(entry);
                size += s;
            }
            flush();
            continue;
        }
        if (size + f.size > budget) {
            flush();
        }
        current.push(...f.entries);
        size += f.size;
    }
    flush();

    return slices.map((entries) => {
        const out = {};
        for (const [surface, k, item] of entries) {
            (out[surface] ||= {})[k] = item;
        }
        return out;
    });
}

const number = (n) => String(n).padStart(2, '0');

/**
 * Write items to dir as slices, 01.json onwards, replacing what dir held. Each
 * is a complete worklist: header, then which slice it is, with answers the
 * answer file its translator writes (answers(name), relative to the workdir),
 * and its items. Returns how many it wrote.
 */
export function writeSlices(dir, header, items, answers) {
    fs.rmSync(dir, {recursive: true, force: true});
    const slices = cut(items);
    slices.forEach((body, i) => {
        const name = number(i + 1);
        writeJSON(path.join(dir, `${name}.json`), {...header, slice: `${i + 1} of ${slices.length}`, ...(answers ? {answers: answers(name)} : {}), ...body});
    });
    return slices.length;
}

/**
 * The work no answer covers yet, as slices for translators: the locale's
 * worklist items named in refs ("surface:key"), written to remaining/<locale>/,
 * or that directory removed when there are none. Each round answers into files
 * of its own, r1-01.json and on, named for the first round none of answerFiles
 * uses yet, so it never overwrites an answer. Returns how many slices it wrote.
 */
export function writeRemaining(p, locale, refs, answerFiles) {
    const dir = p.remainingFor(locale);
    const worklist = readSlices(p.worklistsFor(locale));
    if (!refs.size || !worklist) {
        fs.rmSync(dir, {recursive: true, force: true});
        return 0;
    }
    const left = {};
    for (const [surface, items] of Object.entries(worklist.items)) {
        const keep = Object.entries(items).filter(([k]) => refs.has(`${surface}:${k}`));
        if (keep.length) {
            left[surface] = Object.fromEntries(keep);
        }
    }
    const used = new Set(answerFiles.map((f) => path.basename(f).match(/^r(\d+)-/)?.[1]).filter(Boolean).map(Number));
    let round = 1;
    while (used.has(round)) {
        round++;
    }
    return writeSlices(dir, worklist.header, left, (name) => `translations/${locale}/r${round}-${name}.json`);
}

/** The slices in dir together: {header, items}, or null if dir has none. */
export function readSlices(dir) {
    if (!fs.existsSync(dir)) {
        return null;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    if (!files.length) {
        return null;
    }
    const items = {};
    let header;
    for (const f of files) {
        const body = readJSON(path.join(dir, f));
        header ||= {locale: body.locale, base: body.base, language: body.language};
        for (const surface of Object.keys(SURFACES)) {
            Object.assign(items[surface] ||= {}, body[surface] || {});
        }
    }
    return {header, items};
}
