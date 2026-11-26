// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Work out, per locale, what a translation run has to do. It reads through a
// tree, so it can run over the working tree, as plan_translations.mjs does, or over the
// commit a run started from, to re-derive what that run was allowed to change.
//
// For each surface and locale, against en.json now and en.json at the locale's
// baseline commit:
//
//   prune   keys the catalog has and en.json no longer does
//   carry   a key renamed with its English and description unchanged: the old
//           key's translation moves to the new one, with no translator involved
//   items   the worklist, in en.json order:
//             new      nothing to start from
//             changed  an existing translation to start from, in current, and
//                      the English and description it translates, in previous:
//                        - the key's own, when its English changed since the
//                          baseline
//                        - a removed key's, carriedFrom, when the key was
//                          renamed and its English or description changed
//                        - another key's, sameAs, when that key has the
//                          identical English
//                      The translator returns either a new translation or the
//                      current one.
//             repair   translated, but the translation breaks a rule the
//                      catalogs are being brought up to: a webapp plural
//                      missing a form, or the wrong form of address. The
//                      translator fixes it, or returns it unchanged when it is
//                      right as it is.
import {catalogPath, flatten, isBlank, localesOf, parseCatalog, readBaseline, readSource, same, stableText, SURFACES} from './catalogs.mjs';
import {readStyle} from './glossary.mjs';
import {repairProblems} from './rules.mjs';

export function computePlan({tree, history, base}) {
    const baseline = readBaseline(tree);
    const sources = new Map();
    const sourceAt = (rev, surface) => {
        const id = `${rev}:${surface}`;
        if (!sources.has(id)) {
            sources.set(id, readSource(history(rev), surface));
        }
        return sources.get(id);
    };

    const plan = {base, surfaces: {}, undescribed: {webapp: {}, server: {}}};
    for (const surface of Object.keys(SURFACES)) {
        const en = readSource(tree, surface);
        const locales = {};

        for (const locale of localesOf(tree, surface)) {
            const {map} = parseCatalog(tree.read(catalogPath(surface, locale)), surface);
            const marker = baseline[surface][locale] || null;
            const then = marker ? sourceAt(marker, surface) : null;
            const style = readStyle(tree, locale);

            const prune = {};
            for (const [k, v] of map) {
                if (!en.has(k)) {
                    prune[k] = v;
                }
            }

            const stale = (k) => then?.has(k) && !same(then.get(k).english, en.get(k).english);
            const {carry, renamed} = findRenames({en, then, map, retired: Object.keys(prune)});
            const sameEnglish = settledByEnglish({en, map, stale});

            const items = {};
            for (const [k, {english, description}] of en) {
                const current = map.get(k);
                if (carry[k]) {
                    continue;
                }
                if (renamed[k]) {
                    const old = renamed[k];
                    items[k] = {kind: 'changed', english, description, previous: then.get(old), current: map.get(old), carriedFrom: old};
                } else if (isBlank(current)) {
                    const other = sameEnglish.get(stableText(english));
                    items[k] = other ?
                        {kind: 'changed', english, description, previous: en.get(other), current: map.get(other), sameAs: other} :
                        {kind: 'new', english, description};
                } else if (stale(k)) {
                    items[k] = {kind: 'changed', english, description, previous: then.get(k), current};
                } else {
                    const problems = repairProblems({english, value: current, locale, surface, style});
                    if (problems.length) {
                        items[k] = {kind: 'repair', english, description, current, problems};
                    }
                    continue;
                }
                if (!description.trim()) {
                    plan.undescribed[surface][k] = english;
                }
            }

            locales[locale] = {marker, prune, carry, items};
        }
        plan.surfaces[surface] = {locales};
    }
    return plan;
}

// How close two English strings are, from 0 to 1: the share of words they have
// in common. Word order and punctuation don't count.
function similarity(a, b) {
    const words = (s) => flatten(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const wa = words(a);
    const wb = words(b);
    if (!wa.length || !wb.length) {
        return same(a, b) ? 1 : 0;
    }
    const counts = new Map();
    wa.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
    let common = 0;
    for (const w of wb) {
        if (counts.get(w) > 0) {
            counts.set(w, counts.get(w) - 1);
            common++;
        }
    }
    return (2 * common) / (wa.length + wb.length);
}

// Below this, a removed key and a new one are not taken for the same string.
export const RENAME_SIMILARITY = 0.7;

/**
 * Renames, for one locale: a key en.json dropped, translated here, and a key
 * en.json gained, untranslated here, each the other's closest match by English,
 * with no tie. With the English and description unchanged, the old translation
 * is carried as is. Otherwise it goes to the translator as a changed item, to
 * keep or adjust.
 */
function findRenames({en, then, map, retired}) {
    const carry = {};
    const renamed = {};
    if (!then) {
        return {carry, renamed};
    }

    const olds = retired.filter((old) => then.has(old) && !isBlank(map.get(old)));
    const news = [...en.keys()].filter((k) => !then.has(k) && isBlank(map.get(k)));
    if (!olds.length || !news.length) {
        return {carry, renamed};
    }

    // The single closest match for each key on either side, or null on a tie.
    const best = (keys, english, others, englishOf) => {
        const out = new Map();
        for (const k of keys) {
            let top = 0;
            let match = null;
            for (const o of others) {
                const s = similarity(english(k), englishOf(o));
                if (s > top) {
                    top = s;
                    match = o;
                } else if (s === top) {
                    match = null;
                }
            }
            out.set(k, top >= RENAME_SIMILARITY ? match : null);
        }
        return out;
    };
    const newEnglish = (k) => en.get(k).english;
    const oldEnglish = (k) => then.get(k).english;
    const forOld = best(olds, oldEnglish, news, newEnglish);
    const forNew = best(news, newEnglish, olds, oldEnglish);

    for (const [old, newKey] of forOld) {
        if (!newKey || forNew.get(newKey) !== old) {
            continue;
        }
        const was = then.get(old);
        const now = en.get(newKey);
        if (same(was.english, now.english) && was.description === now.description) {
            carry[newKey] = old;
        } else {
            renamed[newKey] = old;
        }
    }
    return {carry, renamed};
}

/**
 * For each English string, a key that translates it in this catalog and is
 * up to date: the first in en.json order among those sharing the most common
 * translation.
 */
function settledByEnglish({en, map, stale}) {
    const byEnglish = new Map();
    for (const [k, {english}] of en) {
        const value = map.get(k);
        if (isBlank(value) || stale(k)) {
            continue;
        }
        const id = stableText(english);
        const translations = byEnglish.get(id) || new Map();
        const t = stableText(value);
        translations.set(t, [...(translations.get(t) || []), k]);
        byEnglish.set(id, translations);
    }
    const out = new Map();
    for (const [id, translations] of byEnglish) {
        const [keys] = [...translations.values()].sort((a, b) => b.length - a.length);
        out.set(id, keys[0]);
    }
    return out;
}

/**
 * Every key a translator will see as new or changed in some locale, once, with
 * its English and description: what a glossary pass reads. Repairs are left out,
 * since their English is not new.
 */
export function newStrings(plan) {
    const out = {webapp: {}, server: {}};
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const {items} of Object.values(locales)) {
            for (const [k, item] of Object.entries(items)) {
                if (item.kind !== 'repair') {
                    out[surface][k] = {english: item.english, description: item.description};
                }
            }
        }
    }
    return out;
}

export function counts(plan) {
    const out = {};
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const [locale, l] of Object.entries(locales)) {
            out[locale] ||= {new: 0, changed: 0, repair: 0, carry: 0, prune: 0};
            const c = out[locale];
            for (const item of Object.values(l.items)) {
                c[item.kind]++;
            }
            c.carry += Object.keys(l.carry).length;
            c.prune += Object.keys(l.prune).length;
            c[surface] = Object.keys(l.items).length;
        }
    }
    return out;
}
