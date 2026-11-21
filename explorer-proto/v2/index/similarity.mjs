// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {tokenSet, tokenize} from './fingerprint.mjs';
import {compareStr} from './lib/strings.mjs';

/**
 * Score = sum(w_i * c_i) / sum(w_i) over the components that apply to the candidate.
 * Every component is in [0,1]. See README.md for the full derivation.
 */
export const WEIGHTS = Object.freeze({ui: 0.35, assertion: 0.25, goal: 0.2, actor_setup: 0.15, tags: 0.05});
export const BLEND = Object.freeze({containment: 0.7, f1: 0.3});
export const STRONG_LABEL_DICE = 0.6;
export const ACTOR_SETUP_SPLIT = Object.freeze({actors: 0.4, setup: 0.6});
export const THRESHOLDS = Object.freeze({
    needs_review: Object.freeze({score: 0.35, label_coverage: 0.34}),
    likely_duplicate: Object.freeze({score: 0.7, ui_label_coverage: 0.8, assertion_label_coverage: 0.8}),
});

const GENERIC_PATH = new Set([
    'e2e-tests',
    'cypress',
    'playwright',
    'tests',
    'specs',
    'integration',
    'functional',
    'spec',
    'channels',
    'js',
    'ts',
]);

function pathTokens(file) {
    const out = [];
    for (const seg of file.split('/')) {
        const base = seg.replace(/\.(spec|test)?\.?(ts|js)$/, '').replace(/_spec$/, '');
        if (!GENERIC_PATH.has(base)) {
            out.push(...tokenize(base));
        }
    }
    return out;
}

function labelItems(texts) {
    const seen = new Set();
    const items = [];
    for (const text of texts) {
        for (const seg of String(text ?? '').split(' > ')) {
            const key = seg.trim();
            if (!key || seen.has(key)) {
                continue;
            }
            seen.add(key);
            const tokens = new Set(tokenize(key));
            if (tokens.size) {
                items.push(tokens);
            }
        }
    }
    return items;
}

export function testDoc(t) {
    const uiTexts = [];
    for (const a of t.actions) {
        uiTexts.push(a.target, a.text ?? '');
    }
    uiTexts.push(...t.locators);
    const assertTexts = [];
    for (const a of t.assertions) {
        assertTexts.push(a.target, ...(a.expected ?? []));
    }
    const goalTexts = [t.title, ...t.describe, t.objective ?? '', ...t.narrative.map((n) => n.text), ...t.tags];
    const setupTexts = [];
    for (const s of t.setup) {
        setupTexts.push(s.name, ...(s.detail ?? []));
    }
    const uiItems = labelItems([...t.actions.flatMap((a) => [a.target, a.text ?? '']), ...t.locators]);
    const assertionItems = labelItems(t.assertions.flatMap((a) => [a.target, ...(a.expected ?? [])]));
    const goal = tokenSet(goalTexts);
    for (const tok of pathTokens(t.file)) {
        goal.add(tok);
    }
    const testIds = new Set();
    for (const l of t.locators) {
        for (const m of l.matchAll(/testid:([^ >]+)/g)) {
            testIds.add(m[1].toLowerCase());
        }
    }
    return {
        rec: t,
        uiItems,
        assertionItems,
        ui: tokenSet(uiTexts),
        assertion: tokenSet(assertTexts),
        goal,
        setup: tokenSet(setupTexts),
        ids: new Set([
            ...t.mm_t_ids.map((i) => i.toLowerCase()),
            ...t.tags.map((x) => x.toLowerCase()),
            ...[...testIds].map((i) => `testid:${i}`),
        ]),
    };
}

export function candidateDoc(c) {
    const checkpoints = c.checkpoints ?? [];
    const labels = [...(c.ui_labels ?? []), ...checkpoints.flatMap((cp) => cp.labels ?? [])];
    const expected = checkpoints.flatMap((cp) => cp.expected_text ?? []);
    const goalTexts = [c.title ?? '', ...(c.goal_terms ?? []), ...checkpoints.map((cp) => cp.description ?? '')];
    const ids = new Set();
    for (const text of [c.title ?? '', ...(c.goal_terms ?? []), ...checkpoints.map((cp) => cp.description ?? '')]) {
        for (const m of text.matchAll(/MM-T\d+(?:_\d+)?/gi)) {
            ids.add(m[0].toLowerCase());
        }
        for (const m of text.matchAll(/(?<![\w])@[\w-]+/g)) {
            ids.add(m[0].toLowerCase());
        }
    }
    for (const l of c.ui_labels ?? []) {
        const m = /^(?:testid:|data-testid=)(.+)$/i.exec(l.trim());
        if (m) {
            ids.add(`testid:${m[1].toLowerCase()}`);
        }
    }
    const assertionLabels = [...checkpoints.flatMap((cp) => cp.labels ?? []), ...expected];
    return {
        uiItems: labelItems(labels),
        assertionItems: labelItems(assertionLabels),
        ui: tokenSet(labels),
        assertion: tokenSet(assertionLabels),
        goal: tokenSet(goalTexts),
        setup: tokenSet(c.setup ?? []),
        ids,
        actorCount: (c.actors ?? []).length,
    };
}

export function buildCorpus(tests, {excludeSessions = false, includeEmitted = false} = {}) {
    const eligible = tests.filter((t) => {
        if (excludeSessions && t.origin === 'session') {
            return false;
        }
        if (!includeEmitted && t.origin === 'emitted') {
            return false;
        }
        return true;
    });
    const docs = eligible.map(testDoc);
    const idf = {};
    for (const field of ['ui', 'assertion', 'goal', 'setup']) {
        const df = new Map();
        for (const d of docs) {
            for (const tok of d[field]) {
                df.set(tok, (df.get(tok) ?? 0) + 1);
            }
        }
        const n = docs.length;
        idf[field] = {df, weight: (tok) => Math.log(1 + n / (1 + (df.get(tok) ?? 0)))};
    }
    return {docs, idf, size: docs.length};
}

function weightedMatch(candSet, docSet, idf) {
    if (candSet.size === 0) {
        return {value: 0, shared: []};
    }
    let cw = 0;
    let dw = 0;
    let sw = 0;
    const shared = [];
    for (const t of candSet) {
        cw += idf.weight(t);
    }
    for (const t of docSet) {
        dw += idf.weight(t);
    }
    for (const t of candSet) {
        if (docSet.has(t)) {
            sw += idf.weight(t);
            shared.push(t);
        }
    }
    const recall = cw ? sw / cw : 0;
    const precision = dw ? sw / dw : 0;
    const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
    return {value: BLEND.containment * recall + BLEND.f1 * f1, recall, precision, shared};
}

function labelMatch(candItems, docItems, idf) {
    let mass = 0;
    let acc = 0;
    let strong = 0;
    const best = [];
    for (const c of candItems) {
        let cm = 0;
        for (const t of c) {
            cm += idf.weight(t);
        }
        let top = 0;
        for (const l of docItems) {
            let shared = 0;
            let lm = 0;
            for (const t of l) {
                const w = idf.weight(t);
                lm += w;
                if (c.has(t)) {
                    shared += w;
                }
            }
            if (shared > 0) {
                top = Math.max(top, (2 * shared) / (cm + lm));
            }
        }
        mass += cm;
        acc += cm * top;
        if (top >= STRONG_LABEL_DICE) {
            strong += cm;
        }
        best.push(top);
    }
    const value = mass ? acc / mass : 0;
    const labelCov = mass ? strong / mass : 0;
    return {value, label_coverage: labelCov, mass, strong, best};
}

export function scoreDoc(cand, doc, corpus) {
    const parts = {};
    const applicable = {};
    if (cand.ui.size) {
        parts.ui = labelMatch(cand.uiItems, doc.uiItems, corpus.idf.ui);
        applicable.ui = parts.ui.value;
    }
    if (cand.assertion.size) {
        parts.assertion = labelMatch(cand.assertionItems, doc.assertionItems, corpus.idf.assertion);
        applicable.assertion = parts.assertion.value;
    }
    if (cand.goal.size) {
        parts.goal = weightedMatch(cand.goal, doc.goal, corpus.idf.goal);
        applicable.goal = parts.goal.value;
    }
    const hasActors = cand.actorCount > 0;
    if (hasActors || cand.setup.size) {
        const a = Math.max(1, cand.actorCount);
        const b = Math.max(1, doc.rec.actors.count);
        const actorSim = hasActors ? 1 - Math.abs(a - b) / Math.max(a, b) : null;
        const setup = cand.setup.size ? weightedMatch(cand.setup, doc.setup, corpus.idf.setup) : null;
        let value;
        if (actorSim !== null && setup) {
            value = ACTOR_SETUP_SPLIT.actors * actorSim + ACTOR_SETUP_SPLIT.setup * setup.value;
        } else {
            value = actorSim ?? setup.value;
        }
        parts.actor_setup = {value, actor_similarity: actorSim, setup};
        applicable.actor_setup = value;
    }
    if (cand.ids.size) {
        let hits = 0;
        const matched = [];
        for (const id of cand.ids) {
            if (doc.ids.has(id)) {
                hits += 1;
                matched.push(id);
            }
        }
        parts.tags = {value: hits / cand.ids.size, matched};
        applicable.tags = parts.tags.value;
    }
    let num = 0;
    let den = 0;
    for (const [k, v] of Object.entries(applicable)) {
        num += WEIGHTS[k] * v;
        den += WEIGHTS[k];
    }
    const score = den ? num / den : 0;
    return {score, components: applicable, parts};
}

export function rank(corpus, candidate, k = 8) {
    const cand = candidateDoc(candidate);
    const scored = corpus.docs.map((doc) => ({doc, ...scoreDoc(cand, doc, corpus)}));
    scored.sort(
        (a, b) => b.score - a.score || compareStr(a.doc.rec.file, b.doc.rec.file) || a.doc.rec.line - b.doc.rec.line,
    );
    return {cand, ranked: scored.slice(0, k), all: scored};
}

function labelCoverage(parts) {
    const sets = [parts.ui, parts.assertion].filter(Boolean);
    const mass = sets.reduce((n, p) => n + p.mass, 0);
    return mass ? sets.reduce((n, p) => n + p.strong, 0) / mass : 0;
}

export function verdictFor(ranked) {
    const L = THRESHOLDS.likely_duplicate;
    const R = THRESHOLDS.needs_review;
    let verdict = 'no_close_match';
    for (const r of ranked) {
        const p = r.parts;
        const dup =
            r.score >= L.score &&
            (!p.ui || p.ui.label_coverage >= L.ui_label_coverage) &&
            (!p.assertion || p.assertion.label_coverage >= L.assertion_label_coverage);
        if (dup) {
            return 'likely_duplicate';
        }
        if (r.score >= R.score && labelCoverage(p) >= R.label_coverage) {
            verdict = 'needs_review';
        }
    }
    return verdict;
}

export {labelCoverage};
