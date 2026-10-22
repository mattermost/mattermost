// Work out, per locale, what a translation run has to do. It reads through a
// tree, so it can run over the working tree, as plan.mjs does, or over the
// commit a run started from, to re-derive what that run was allowed to change.
//
// For each surface and locale, against en.json now and en.json at the locale's
// baseline commit:
//
//   items   the worklist, in en.json order:
//             new      no translation yet
//             changed  translated, but the English changed since the baseline.
//                      The translator gets the previous English and the
//                      current translation, and returns either a new
//                      translation or the current one.
import {catalogPath, isBlank, localesOf, parseCatalog, readBaseline, readSource, same, SURFACES} from './catalogs.mjs';

// Past these, something other than ordinary development moved en.json, and
// fanning out translators would multiply the mistake rather than fix it.
export const UNUSUAL = {new: 1000, changed: 300};

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

    const plan = {base, surfaces: {}, undescribed: {webapp: {}, server: {}}, unusual: []};
    for (const surface of Object.keys(SURFACES)) {
        const en = readSource(tree, surface);
        const locales = {};
        const distinct = {new: new Set(), changed: new Set()};

        for (const locale of localesOf(tree, surface)) {
            const {map} = parseCatalog(tree.read(catalogPath(surface, locale)), surface);
            const marker = baseline[surface][locale] || null;
            const then = marker ? sourceAt(marker, surface) : null;

            const items = {};
            for (const [k, {english, description}] of en) {
                const current = map.get(k);
                if (isBlank(current)) {
                    items[k] = {kind: 'new', english, description};
                } else if (then?.has(k) && !same(then.get(k).english, english)) {
                    items[k] = {kind: 'changed', english, description, previous: then.get(k), current};
                } else {
                    continue;
                }
                distinct[items[k].kind].add(k);
                if (!description.trim()) {
                    plan.undescribed[surface][k] = english;
                }
            }

            locales[locale] = {marker, items};
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

export function counts(plan) {
    const out = {};
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const [locale, l] of Object.entries(locales)) {
            const c = out[locale] ||= {new: 0, changed: 0};
            for (const item of Object.values(l.items)) {
                c[item.kind]++;
            }
            c[surface] = Object.keys(l.items).length;
        }
    }
    return out;
}
