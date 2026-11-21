// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {runCheck} from './coverage-check.mjs';
import {ensureIndex, loadIndex} from './extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 3, 5, 8];

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

export function resolveLead(tests, lead) {
    const inFile = tests.filter((t) => t.file.endsWith(`/${lead.file}`) || t.file === lead.file);
    const files = [...new Set(inFile.map((t) => t.file))];
    if (files.length !== 1) {
        return {status: files.length ? 'ambiguous_file' : 'file_not_found', files};
    }
    const containing = inFile
        .filter((t) => t.line <= lead.line && lead.line <= t.end_line)
        .sort((a, b) => b.line - a.line)[0];
    if (containing) {
        return {status: 'exact', test: containing};
    }
    const nearest = [...inFile].sort((a, b) => Math.abs(a.line - lead.line) - Math.abs(b.line - lead.line))[0];
    return nearest
        ? {status: 'nearest', test: nearest, distance: Math.abs(nearest.line - lead.line)}
        : {status: 'no_tests_in_file', files};
}

export function evaluate({tests, expectations, candidatesDir, excludeSessions = true, includeEmitted = false}) {
    const rows = [];
    const negatives = [];
    const corrections = [];
    for (const pair of expectations.pairs) {
        const candidate = JSON.parse(fs.readFileSync(path.join(candidatesDir, `${pair.candidate}.json`), 'utf8'));
        const report = runCheck({tests, candidate, k: 8, excludeSessions, includeEmitted});
        const order = report.all_scores
            .slice()
            .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
            .map((x) => x.id);
        const idToFile = new Map(tests.map((t) => [t.id, t.file]));
        if (pair.kind === 'negative') {
            negatives.push({
                candidate: pair.candidate,
                verdict: report.verdict,
                top: report.results[0],
                second: report.results[1],
            });
            continue;
        }
        for (const lead of pair.expected) {
            const r = resolveLead(tests, lead);
            const entry = {candidate: pair.candidate, lead, resolution: r.status};
            if (r.test) {
                entry.test = {
                    id: r.test.id,
                    title: r.test.title,
                    line: r.test.line,
                    end_line: r.test.end_line,
                    source_status: r.test.source_status,
                };
                const idx = order.indexOf(r.test.id);
                entry.rank = idx >= 0 ? idx + 1 : null;
                const fileIdx = order.findIndex((id) => idToFile.get(id) === r.test.file);
                entry.file_rank = fileIdx >= 0 ? fileIdx + 1 : null;
                entry.verdict = report.verdict;
                entry.score = report.all_scores.find((x) => x.id === r.test.id)?.score;
                entry.top1_score = report.results[0].score;
                entry.top1 = report.results[0].test.id;
                if (r.status !== 'exact') {
                    corrections.push({lead, resolved: r.test.id, title: r.test.title, distance: r.distance});
                }
            } else {
                entry.rank = null;
                corrections.push({lead, resolved: null, status: r.status});
            }
            rows.push(entry);
        }
    }
    const recall = {};
    for (const k of KS) {
        recall[k] = rows.filter((r) => r.rank !== null && r.rank <= k).length / rows.length;
    }
    const fileRecall = {};
    for (const k of KS) {
        fileRecall[k] = rows.filter((r) => r.file_rank !== null && r.file_rank <= k).length / rows.length;
    }
    const byCandidate = {};
    for (const r of rows) {
        (byCandidate[r.candidate] ??= []).push(r);
    }
    const pairRecall = {};
    for (const k of KS) {
        const hits = Object.values(byCandidate).filter((list) =>
            list.some((r) => r.rank !== null && r.rank <= k),
        ).length;
        pairRecall[k] = hits / Object.keys(byCandidate).length;
    }
    return {
        rows,
        negatives,
        corrections,
        recall,
        fileRecall,
        pairRecall,
        counts: {expected: rows.length, candidates: Object.keys(byCandidate).length},
    };
}

export function renderMarkdown(result, meta) {
    const out = [];
    out.push('# Duplicate-gate evaluation');
    out.push('');
    out.push(
        `Index \`${meta.cache_key}\` (git ${meta.git_sha.slice(0, 12)}), ${meta.counts.tests} tests. Sessions excluded.`,
    );
    out.push('');
    out.push(
        '| Candidate | Expected test (resolved) | Lead line | Resolution | Rank | File rank | Score | Top-1 score | Verdict |',
    );
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of result.rows) {
        out.push(
            `| ${r.candidate} | ${r.test ? `${r.test.id.replace('e2e-tests/', '')} "${r.test.title.slice(0, 50)}"` : 'unresolved'} | ${r.lead.file}:${r.lead.line} | ${r.resolution} | ${r.rank ?? 'not found'} | ${r.file_rank ?? '-'} | ${r.score?.toFixed(3) ?? '-'} | ${r.top1_score ?? '-'} | ${r.verdict ?? '-'} |`,
        );
    }
    out.push('');
    out.push(
        `Expected-test recall (${result.counts.expected} expected tests): ${KS.map((k) => `@${k} ${(result.recall[k] * 100).toFixed(0)}% (${Math.round(result.recall[k] * result.counts.expected)}/${result.counts.expected})`).join(', ')}`,
    );
    out.push('');
    out.push(
        `File-level recall (best rank of any test in the expected file within top-k): ${KS.map((k) => `@${k} ${(result.fileRecall[k] * 100).toFixed(0)}%`).join(', ')}`,
    );
    out.push('');
    out.push(
        `Candidate-level recall (>=1 expected test within top-k; ${result.counts.candidates} candidates): ${KS.map((k) => `@${k} ${(result.pairRecall[k] * 100).toFixed(0)}%`).join(', ')}`,
    );
    out.push('');
    out.push('| Negative candidate | Verdict | Top-1 score | Top-1 test |');
    out.push('| --- | --- | --- | --- |');
    for (const n of result.negatives) {
        out.push(`| ${n.candidate} | ${n.verdict} | ${n.top.score} | ${n.top.test.id.replace('e2e-tests/', '')} |`);
    }
    if (result.corrections.length) {
        out.push('');
        out.push('Leads that did not resolve to a test containing the line:');
        for (const c of result.corrections) {
            out.push(
                `- ${c.lead.file}:${c.lead.line} -> ${c.resolved ?? c.status}${c.distance === undefined ? '' : ` (nearest, ${c.distance} lines away)`}`,
            );
        }
    }
    return `${out.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = parseArgs(process.argv.slice(2));
    const dir = ensureIndex(args.index ? path.resolve(args.index) : undefined);
    const {tests, meta} = loadIndex(dir);
    const expectations = JSON.parse(fs.readFileSync(path.join(HERE, 'eval/expectations.json'), 'utf8'));
    const result = evaluate({
        tests,
        expectations,
        candidatesDir: path.join(HERE, 'eval/candidates'),
        excludeSessions: !args['include-sessions'],
        includeEmitted: Boolean(args['include-emitted']),
    });
    const md = renderMarkdown(result, meta);
    if (args.out) {
        fs.writeFileSync(path.resolve(args.out), md);
    }
    process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : md);
}
