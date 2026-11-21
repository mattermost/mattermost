// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {ensureIndex, loadIndex} from './extract.mjs';
import {tokenSet} from './fingerprint.mjs';
import {
    BLEND,
    STRONG_LABEL_DICE,
    THRESHOLDS,
    WEIGHTS,
    buildCorpus,
    labelCoverage,
    rank,
    verdictFor,
} from './similarity.mjs';

export const VERDICT_NOTE =
    'This tool ranks candidates only. It never states that a test is equivalent: that judgement belongs to a human or agent reviewer, using the three axes below.';

export function validateCandidate(c) {
    if (!c || typeof c !== 'object' || typeof c.title !== 'string' || !c.title.trim()) {
        throw new Error('candidate must be an object with a non-empty "title"');
    }
    for (const key of ['setup', 'goal_terms', 'ui_labels']) {
        if (c[key] !== undefined && !(Array.isArray(c[key]) && c[key].every((x) => typeof x === 'string'))) {
            throw new Error(`candidate.${key} must be an array of strings`);
        }
    }
    if (c.actors !== undefined && !(Array.isArray(c.actors) && c.actors.every((a) => a && typeof a === 'object'))) {
        throw new Error('candidate.actors must be an array of {id, role}');
    }
    if (c.checkpoints !== undefined) {
        if (!Array.isArray(c.checkpoints)) {
            throw new Error('candidate.checkpoints must be an array');
        }
        for (const cp of c.checkpoints) {
            for (const key of ['labels', 'expected_text']) {
                if (cp[key] !== undefined && !(Array.isArray(cp[key]) && cp[key].every((x) => typeof x === 'string'))) {
                    throw new Error(`candidate.checkpoints[].${key} must be an array of strings`);
                }
            }
        }
    }
    return c;
}

const round = (n) => (n === undefined || n === null ? n : Math.round(n * 1000) / 1000);

function uniq(list) {
    return [...new Set(list.filter(Boolean))];
}

function orderedEvents(rec) {
    const events = [
        ...rec.actions.map((a) => ({...a, type: 'action'})),
        ...rec.assertions.map((a) => ({...a, type: 'assertion'})),
    ];
    return events.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

function matchUi(candidateLabels, rec, corpus) {
    const idf = corpus.idf.ui;
    const items = [];
    for (const a of rec.actions) {
        items.push({text: `${a.target} ${a.text ?? ''}`, label: a.label, at: a.at, via: a.via});
    }
    for (const a of rec.assertions) {
        items.push({text: a.target, label: `assert ${a.matcher} ${a.target}`.trim(), at: a.at, via: a.via});
    }
    const out = [];
    for (const label of candidateLabels) {
        const toks = tokenSet([label]);
        if (!toks.size) {
            continue;
        }
        let total = 0;
        for (const t of toks) {
            total += idf.weight(t);
        }
        let best;
        for (const it of items) {
            const set = tokenSet([it.text]);
            let shared = 0;
            for (const t of toks) {
                if (set.has(t)) {
                    shared += idf.weight(t);
                }
            }
            const cover = total ? shared / total : 0;
            if (!best || cover > best.cover) {
                best = {cover, item: it};
            }
        }
        out.push({
            candidate_label: label,
            coverage: round(best?.cover ?? 0),
            test_label: best && best.cover > 0 ? best.item.label : null,
            at: best && best.cover > 0 ? best.item.at : null,
            via: best && best.cover > 0 ? best.item.via : undefined,
        });
    }
    return out;
}

function matchAssertions(cand, rec, corpus) {
    const idf = corpus.idf.assertion;
    const out = [];
    for (const a of rec.assertions) {
        const set = tokenSet([a.target, ...(a.expected ?? [])]);
        let weight = 0;
        const shared = [];
        for (const t of cand.assertion) {
            if (set.has(t)) {
                weight += idf.weight(t);
                shared.push(t);
            }
        }
        if (shared.length) {
            out.push({
                at: a.at,
                via: a.via,
                matcher: a.matcher,
                negated: a.negated || undefined,
                target: a.target,
                expected: a.expected,
                shared_tokens: shared.sort(),
                weight: round(weight),
            });
        }
    }
    out.sort((x, y) => y.weight - x.weight || (x.at < y.at ? -1 : 1));
    return out.slice(0, 6);
}

function axes(candidate, rec, uiMatches) {
    const checkpoints = candidate.checkpoints ?? [];
    const last = checkpoints[checkpoints.length - 1];
    const events = orderedEvents(rec);
    const matchedAt = new Set(uiMatches.filter((m) => m.coverage >= 0.5).map((m) => m.at));
    return {
        actor_setup: {
            candidate: {actors: candidate.actors ?? [], setup: candidate.setup ?? []},
            test: {
                actors: rec.actors,
                setup: uniq(
                    rec.setup.map(
                        (s) =>
                            `${s.name}${s.detail ? ` [${s.detail.join(', ')}]` : ''}${s.phase === 'hook' ? ' (hook)' : ''} @ ${s.at}`,
                    ),
                ),
            },
        },
        transitions: {
            candidate: uniq([...(candidate.ui_labels ?? []), ...checkpoints.flatMap((c) => c.labels ?? [])]),
            test: events
                .filter((e) => e.type === 'action')
                .map((e) => ({
                    label: e.label,
                    at: e.at,
                    via: e.via,
                    hook: e.phase === 'hook' || undefined,
                    matched: matchedAt.has(e.at) || undefined,
                })),
        },
        final_assertions: {
            candidate: last
                ? {description: last.description, labels: last.labels ?? [], expected_text: last.expected_text ?? []}
                : null,
            test: events
                .filter((e) => e.type === 'assertion' && e.phase !== 'hook')
                .slice(-5)
                .map((e) => ({
                    matcher: e.matcher,
                    negated: e.negated || undefined,
                    target: e.target,
                    expected: e.expected,
                    at: e.at,
                    via: e.via,
                })),
        },
    };
}

export function runCheck({tests, candidate, k = 8, excludeSessions = false, includeEmitted = false}) {
    validateCandidate(candidate);
    const corpus = buildCorpus(tests, {excludeSessions, includeEmitted});
    const {cand, ranked, all} = rank(corpus, candidate, k);
    const candidateLabels = uniq([
        ...(candidate.ui_labels ?? []),
        ...(candidate.checkpoints ?? []).flatMap((c) => c.labels ?? []),
    ]);
    const results = ranked.map((r, i) => {
        const rec = r.doc.rec;
        const ui = matchUi(candidateLabels, rec, corpus);
        return {
            rank: i + 1,
            score: round(r.score),
            components: Object.fromEntries(Object.entries(r.components).map(([key, v]) => [key, round(v)])),
            label_coverage: {
                ui: round(r.parts.ui?.label_coverage),
                assertion: round(r.parts.assertion?.label_coverage),
                combined: round(labelCoverage(r.parts)),
            },
            test: {
                id: rec.id,
                suite: rec.suite,
                origin: rec.origin,
                file: rec.file,
                line: rec.line,
                title: rec.title,
                describe: rec.describe,
                tags: rec.tags,
                mm_t_ids: rec.mm_t_ids,
                source_status: rec.source_status,
                partial_reasons: rec.partial_reasons,
                fingerprint: rec.fingerprint,
            },
            matched: {ui: ui.filter((m) => m.coverage > 0), assertions: matchAssertions(cand, rec, corpus)},
            axes: axes(candidate, rec, ui),
        };
    });
    const verdict = verdictFor(ranked);
    return {
        candidate: candidate.title,
        verdict,
        note: VERDICT_NOTE,
        corpus: {tests: corpus.size, exclude_sessions: excludeSessions, include_emitted: includeEmitted},
        thresholds: THRESHOLDS,
        weights: WEIGHTS,
        blend: BLEND,
        strong_label_dice: STRONG_LABEL_DICE,
        results,
        all_scores: all.map((a) => ({id: a.doc.rec.id, score: a.score})),
    };
}

function clip(text, width) {
    const t = String(text ?? '');
    return t.length > width ? `${t.slice(0, width - 1)}…` : t.padEnd(width);
}

function sideBySide(left, right, width = 54) {
    const n = Math.max(left.length, right.length);
    const lines = [];
    for (let i = 0; i < n; i++) {
        lines.push(`    ${clip(left[i] ?? '', width)} | ${clip(right[i] ?? '', width)}`.trimEnd());
    }
    return lines;
}

const shortAt = (at, via) => `${at.replace(/^e2e-tests\//, '')}${via ? ` (via ${via.split(':').pop()})` : ''}`;

export function renderText(report) {
    const out = [];
    out.push(`candidate: ${report.candidate}`);
    const R = THRESHOLDS.needs_review;
    const L = THRESHOLDS.likely_duplicate;
    out.push(
        `verdict: ${report.verdict}  (top-1 score ${report.results[0]?.score ?? 0}; needs_review: score >= ${R.score} and label coverage >= ${R.label_coverage}; likely_duplicate: score >= ${L.score} and ui/assertion label coverage >= ${L.ui_label_coverage}/${L.assertion_label_coverage}; any of the top-k qualifies)`,
    );
    out.push(report.note);
    out.push(
        `corpus: ${report.corpus.tests} tests (exclude_sessions=${report.corpus.exclude_sessions}, include_emitted=${report.corpus.include_emitted})`,
    );
    for (const r of report.results) {
        const c = r.components;
        const comp = ['ui', 'assertion', 'goal', 'actor_setup', 'tags']
            .map((key) => `${key} ${c[key] === undefined ? '-' : c[key].toFixed(2)}`)
            .join(' | ');
        out.push('');
        out.push(`#${r.rank}  score ${r.score.toFixed(3)}  [${comp}]  label coverage ${r.label_coverage.combined}`);
        out.push(
            `    ${r.test.suite} ${r.test.file}:${r.test.line}${r.test.source_status === 'partial' ? '  (source_status: partial)' : ''}`,
        );
        out.push(
            `    "${r.test.title}"  describe: ${r.test.describe.join(' > ') || '-'}  tags: ${r.test.tags.join(' ') || '-'}`,
        );
        out.push('  axis 1 - actors + setup (candidate | existing test)');
        const a = r.axes.actor_setup;
        const left1 = [
            `actors: ${a.candidate.actors.map((x) => `${x.id}${x.role ? `(${x.role})` : ''}`).join(', ') || '-'}`,
            ...a.candidate.setup.map((s) => `setup: ${s}`),
        ];
        const right1 = [
            `actors: ${a.test.actors.count} [${a.test.actors.keys.join(', ')}]`,
            ...a.test.setup.slice(0, 8).map((s) => `setup: ${s}`),
        ];
        out.push(...sideBySide(left1, right1));
        out.push('  axis 2 - transition labels (candidate | existing test; * = matched candidate label)');
        const left2 = a2(r.axes.transitions.candidate);
        const right2 = r.axes.transitions.test
            .slice(0, 14)
            .map((t) => `${t.matched ? '*' : ' '}${t.hook ? 'h ' : ''}${t.label}  @${t.at.split('/').pop()}`);
        out.push(...sideBySide(left2, right2));
        out.push('  axis 3 - final assertions (candidate | existing test, last 5)');
        const f = r.axes.final_assertions;
        const left3 = f.candidate
            ? [
                  f.candidate.description ?? '',
                  ...f.candidate.labels.map((l) => `label: ${l}`),
                  ...f.candidate.expected_text.map((t) => `expect: "${t}"`),
              ]
            : ['-'];
        const right3 = f.test.map(
            (t) =>
                `${t.negated ? 'not ' : ''}${t.matcher} ${t.target}${t.expected?.length ? ` ${JSON.stringify(t.expected)}` : ''}  @${t.at.split('/').pop()}`,
        );
        out.push(...sideBySide(left3, right3));
        if (r.matched.assertions.length) {
            out.push('  matching assertions:');
            for (const m of r.matched.assertions) {
                out.push(
                    `    ${shortAt(m.at, m.via)}  ${m.negated ? 'not ' : ''}${m.matcher} ${m.target}${m.expected?.length ? ` ${JSON.stringify(m.expected)}` : ''}  [${m.shared_tokens.join(' ')}]`,
                );
            }
        }
        const uiHits = r.matched.ui.filter((m) => m.coverage >= 0.5);
        if (uiHits.length) {
            out.push('  matching UI labels:');
            for (const m of uiHits) {
                out.push(
                    `    "${m.candidate_label}" -> ${m.test_label}  ${shortAt(m.at, m.via)}  (coverage ${m.coverage})`,
                );
            }
        }
    }
    return `${out.join('\n')}\n`;
}

function a2(list) {
    return list.length ? list.map((l) => `- ${l}`) : ['-'];
}

function parseArgs(argv) {
    const args = {};
    for (const a of argv) {
        const m = /^--([\w-]+)(?:=(.*))?$/.exec(a);
        if (m) {
            args[m[1]] = m[2] ?? true;
        }
    }
    return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = parseArgs(process.argv.slice(2));
    if (!args.candidate) {
        process.stderr.write(
            'usage: coverage-check.mjs [--index=<dir>] --candidate=<file.json> [--k=8] [--exclude-sessions] [--include-emitted] [--json]\n',
        );
        process.exit(2);
    }
    try {
        const candidate = JSON.parse(fs.readFileSync(path.resolve(args.candidate), 'utf8'));
        const dir = ensureIndex(
            args.index ? path.resolve(args.index) : undefined,
            args['repo-root'] ? {root: path.resolve(args['repo-root'])} : {},
        );
        const {tests} = loadIndex(dir);
        const report = runCheck({
            tests,
            candidate,
            k: Number(args.k ?? 8),
            excludeSessions: Boolean(args['exclude-sessions']),
            includeEmitted: Boolean(args['include-emitted']),
        });
        delete report.all_scores;
        process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
    } catch (err) {
        process.stderr.write(`coverage-check: ${err.message}\n`);
        process.exit(2);
    }
}
