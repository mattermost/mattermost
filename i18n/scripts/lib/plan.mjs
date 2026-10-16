// Work out, per locale, what a translation run has to do. plan.mjs runs this over
// the working tree; check_run.mjs runs it over the commit a pull request started
// from, to re-derive what that run was allowed to change.
//
// For each surface and locale, against en.json now and en.json at the locale's
// baseline commit:
//
//   prune   keys the catalog has and en.json no longer does
//   carry   a key renamed with its English and description unchanged: the old
//           key's translation moves to the new one, with no translator involved
//   items   the worklist, in en.json order:
//             new      no translation yet
//             changed  translated, but the English changed since the baseline,
//                      or a rename whose description changed. The translator
//                      gets the previous English and the current translation,
//                      and returns either a new translation or the current one.
//             repair   translated, but the translation breaks a rule the
//                      catalogs are being brought up to: a webapp plural
//                      missing a form, or the wrong form of address. Capped
//                      per surface and locale
import {catalogPath, isBlank, localesOf, parseCatalog, readBaseline, readSource, same, stableText, SURFACES} from './catalogs.mjs';
import {readStyle} from './glossary.mjs';
import {repairProblems} from './rules.mjs';

// Past these, something other than ordinary development moved en.json, and
// fanning out translators would multiply the mistake rather than fix it.
export const UNUSUAL = {new: 1000, changed: 300, pruned: 300};

export function computePlan({tree, history, base, maxRepairs = 25}) {
    const baseline = readBaseline(tree);
    const sources = new Map();
    const sourceAt = (rev, surface) => {
        const id = `${rev}:${surface}`;
        if (!sources.has(id)) {
            sources.set(id, readSource(history(rev), surface));
        }
        return sources.get(id);
    };

    const plan = {base, surfaces: {}, undescribed: {webapp: {}, server: {}}, unusual: []};
    for (const surface of Object.keys(SURFACES)) {
        const en = readSource(tree, surface);
        const locales = {};
        const distinct = {new: new Set(), changed: new Set(), pruned: new Set()};

        for (const locale of localesOf(tree, surface)) {
            const {map} = parseCatalog(tree.read(catalogPath(surface, locale)), surface);
            const marker = baseline[surface][locale] || null;
            const then = marker ? sourceAt(marker, surface) : null;
            const style = readStyle(tree, locale);

            const prune = {};
            for (const [k, v] of map) {
                if (!en.has(k)) {
                    prune[k] = v;
                    distinct.pruned.add(k);
                }
            }

            const {carry, redescribed} = findRenames({en, then, map, retired: Object.keys(prune)});

            const items = {};
            const repairs = [];
            for (const [k, {english, description}] of en) {
                const current = map.get(k);
                if (carry[k]) {
                    continue;
                }
                if (redescribed[k]) {
                    const old = redescribed[k];
                    items[k] = {kind: 'changed', english, description, previous: then.get(old), current: map.get(old), carriedFrom: old};
                } else if (isBlank(current)) {
                    items[k] = {kind: 'new', english, description};
                } else if (then?.has(k) && !same(then.get(k).english, english)) {
                    items[k] = {kind: 'changed', english, description, previous: then.get(k), current};
                } else {
                    const problems = repairProblems({english, value: current, locale, surface, style});
                    if (problems.length) {
                        repairs.push([k, {kind: 'repair', english, description, current, problems}]);
                    }
                    continue;
                }
                distinct[items[k].kind].add(k);
                if (!description.trim()) {
                    plan.undescribed[surface][k] = english;
                }
            }
            for (const [k, item] of repairs.slice(0, maxRepairs)) {
                items[k] = item;
            }

            locales[locale] = {marker, prune, carry, items, repairsAvailable: repairs.length};
        }

        for (const [kind, limit] of Object.entries(UNUSUAL)) {
            if (distinct[kind].size > limit) {
                plan.unusual.push(`${surface}: ${distinct[kind].size} distinct ${kind} keys, more than the ${limit} a day of development produces`);
            }
        }
        plan.surfaces[surface] = {locales};
    }
    return plan;
}

/**
 * Renames, for one locale: a key en.json dropped whose English, as of the
 * baseline, is now the English of exactly one key the catalog lacks, and no
 * other dropped key shares it. With the description unchanged too, the old
 * translation is carried as is. With a changed description, it goes to the
 * translator as a changed item, since a clarified description can mean the old
 * translation had the wrong sense.
 */
function findRenames({en, then, map, retired}) {
    const carry = {};
    const redescribed = {};
    if (!then) {
        return {carry, redescribed};
    }

    const untranslated = new Map();
    for (const [k, {english}] of en) {
        if (isBlank(map.get(k))) {
            const id = stableText(english);
            untranslated.set(id, [...(untranslated.get(id) || []), k]);
        }
    }

    const claims = new Map();
    for (const old of retired) {
        if (!then.has(old) || isBlank(map.get(old))) {
            continue;
        }
        const targets = untranslated.get(stableText(then.get(old).english)) || [];
        if (targets.length === 1) {
            claims.set(targets[0], [...(claims.get(targets[0]) || []), old]);
        }
    }

    for (const [newKey, olds] of claims) {
        if (olds.length !== 1) {
            continue;
        }
        const [old] = olds;
        if (en.get(newKey).description === then.get(old).description) {
            carry[newKey] = old;
        } else {
            redescribed[newKey] = old;
        }
    }
    return {carry, redescribed};
}

export function counts(plan) {
    const out = {};
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const [locale, l] of Object.entries(locales)) {
            const c = out[locale] ||= {new: 0, changed: 0, repair: 0, carry: 0, prune: 0, repairsAvailable: 0};
            for (const item of Object.values(l.items)) {
                c[item.kind]++;
            }
            c.carry += Object.keys(l.carry).length;
            c.prune += Object.keys(l.prune).length;
            c.repairsAvailable += l.repairsAvailable;
            c[surface] = Object.keys(l.items).length;
        }
    }
    return out;
}
