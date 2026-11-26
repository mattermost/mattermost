// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Finalize a run: apply the plan and its payloads to the catalogs, and advance
// the baseline.
//
//   node i18n/scripts/finalize.mjs <workdir> [--no-verify]
//
// In order, all or nothing:
//
//   1. refuse a plan the repository has moved away from since plan_translations.mjs wrote it
//   2. validate every locale's payloads together; any error, or a worklist
//      item a locale with payloads leaves unanswered, applies nothing
//   3. for every catalog, whatever the payloads hold: prune the keys en.json no
//      longer has, carry renamed keys, and write the payload's answers
//   4. run both CI checkers over the result, and restore every file if either
//      fails. --no-verify skips this, for the pipeline's own tests.
//   5. advance i18n/baseline.json to the plan's base for each surface and locale
//      with nothing left to do: one with a payload, or a worklist of repairs at
//      most, since a repair is never owed. A locale left out keeps its
//      baseline, so the next plan finds the same work again.
//
// An error after step 3 has begun restores every file it wrote. An interrupt
// to the process group, such as Ctrl-C, also stops a checker that is running,
// which counts as a failure and restores. One sent to this process alone waits
// until finalize has finished, and changes nothing: the run is complete.
//
// Writes <workdir>/report.md, a summary for the pull request,
// <workdir>/notes.md, the translators' notes by kind, and <workdir>/pruned.json,
// the translations pruning removed. The notes of a large run outgrow a pull
// request description, so they are kept apart, to post as comments.
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {parseArgs} from 'util';

import {BASELINE, catalogPath, parseCatalog, readBaseline, same, serializeBaseline, serializeCatalog} from './lib/catalogs.mjs';
import {formatNotes} from './lib/notes.mjs';
import {commitTree, workingTree} from './lib/repo.mjs';
import {mergePayloads, unanswered, validatePayload} from './lib/validate.mjs';
import {answerFiles, digest, paths, PLAN_VERSION, readJSON, writeJSON} from './lib/workdir.mjs';

const usage = 'usage: node i18n/scripts/finalize.mjs <workdir> [--no-verify]';
let options;
try {
    options = parseArgs({allowPositionals: true, options: {'no-verify': {type: 'boolean', default: false}}});
} catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
}
const [workdir, ...extra] = options.positionals;
if (!workdir || extra.length) {
    console.error(usage);
    process.exit(2);
}

const p = paths(workdir);
if (!fs.existsSync(p.plan)) {
    console.error(`no plan in ${workdir}: run plan_translations.mjs first`);
    process.exit(2);
}
const plan = readJSON(p.plan);
if (plan.version !== PLAN_VERSION) {
    console.error(`${p.plan} was written by another version of plan_translations.mjs; plan again`);
    process.exit(2);
}
const root = plan.root;
const tree = workingTree(root);
const guidance = commitTree(root, plan.base);

// 1. The plan was computed from files that are still the files.
if (digest(tree) !== plan.digest) {
    console.error('the catalogs, en.json or i18n/baseline.json changed since this plan was made; plan again, which keeps every answer whose item is unchanged');
    process.exit(1);
}

// 2. Every payload, before anything is written.
const payloads = {};
const results = {};
let invalid = 0;
for (const [locale, files] of Object.entries(answerFiles(p))) {
    if (!files.length) {
        continue;
    }
    if (!Object.values(plan.surfaces).some(({locales}) => locales[locale])) {
        console.error(`${locale}: payloads for a locale with no catalog`);
        invalid++;
        continue;
    }
    const parts = [];
    const errors = [];
    for (const file of files) {
        try {
            parts.push({file, payload: readJSON(file)});
        } catch (e) {
            errors.push(`cannot read ${file}: ${e.message}`);
        }
    }
    const merged = mergePayloads(parts);
    payloads[locale] = merged.payload;
    results[locale] = validatePayload({plan, locale, payload: merged.payload, tree: guidance});
    const left = unanswered({plan, locale, payload: merged.payload});
    errors.push(...merged.errors, ...results[locale].errors);
    if (left.length) {
        errors.push(`${left.length} worklist item(s) unanswered: ${left.slice(0, 5).join(', ')}${left.length > 5 ? ', ...' : ''}`);
    }
    if (errors.length) {
        invalid++;
        console.error(`${locale}: ${errors.length} error(s), for example:\n  ${errors.slice(0, 5).join('\n  ')}`);
    }
}
if (invalid) {
    console.error('\nnothing applied. See every error with: node i18n/scripts/validate_locale.mjs <workdir> <locale>');
    process.exit(1);
}

// 3. Every catalog.
const originals = new Map();
const write = (rel, text) => {
    const file = path.join(root, rel);
    const before = fs.readFileSync(file, 'utf8');
    if (before !== text) {
        if (!originals.has(file)) {
            originals.set(file, before);
        }
        fs.writeFileSync(file, text);
    }
};
const restore = () => {
    const failed = [];
    for (const [file, text] of originals) {
        try {
            if (fs.readFileSync(file, 'utf8') !== text) {
                fs.writeFileSync(file, text);
            }
        } catch (e) {
            failed.push(`${path.relative(root, file)}: ${e.message}`);
        }
    }
    originals.clear();
    return failed;
};
const abort = (message) => {
    const failed = restore();
    console.error(`${message}\n`);
    console.error(failed.length ?
        `could not restore these; check them with git diff:\n  ${failed.join('\n  ')}` :
        'every catalog is restored; nothing applied');
    process.exit(1);
};

// Handled, so that a signal cannot stop this process halfway through writing
// the catalogs. Nothing yields until finalize is done, so by the time one is
// handled there is nothing left to stop.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {});
}

const pruned = {};
const tally = {};
const behind = {};
try {
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const [locale, l] of Object.entries(locales)) {
            const rel = catalogPath(surface, locale);
            const {map, order} = parseCatalog(tree.read(rel), surface);
            tally[locale] ||= {new: 0, rewritten: 0, kept: 0, repaired: 0, untouched: 0, carried: 0, pruned: 0};
            const t = tally[locale];

            for (const [newKey, oldKey] of Object.entries(l.carry)) {
                map.set(newKey, map.get(oldKey));
                t.carried++;
            }
            const answers = payloads[locale]?.[surface] || {};

            // An unanswered rename keeps its old key, whose translation the next
            // plan offers as the current one.
            const pending = new Set(Object.entries(l.items).filter(([k, item]) => item.carriedFrom && !(k in answers)).map(([, item]) => item.carriedFrom));
            const prune = Object.fromEntries(Object.entries(l.prune).filter(([k]) => !pending.has(k)));
            for (const k of Object.keys(prune)) {
                map.delete(k);
                t.pruned++;
            }
            if (Object.keys(prune).length) {
                (pruned[locale] ||= {})[surface] = prune;
            }

            for (const [k, value] of Object.entries(answers)) {
                const item = l.items[k];
                if (item.kind === 'new') {
                    t.new++;
                } else if (item.kind === 'repair') {
                    t[same(value, item.current) ? 'untouched' : 'repaired']++;
                } else if (same(value, item.current)) {
                    t.kept++;
                } else {
                    t.rewritten++;
                }
                map.set(k, value);
            }
            write(rel, serializeCatalog(map, order, surface));
        }
    }

    // 4. The real checkers, as CI runs them.
    if (!options.values['no-verify']) {
        const run = (cmd, args, cwd) => {
            try {
                execFileSync(cmd, args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 28});
                return null;
            } catch (e) {
                return `${e.stdout || ''}${e.stderr || e.message}`;
            }
        };
        const failures = [
            ['check_icu.mjs', run(process.execPath, ['scripts/check_icu.mjs', 'src/i18n', '--warn-missing-keys'], path.join(root, 'webapp/channels'))],
            ['mmgotool i18n verify', run('go', ['run', '.', 'i18n', 'verify', '--warn-missing-ids', `--server-dir=${path.join(root, 'server')}`], path.join(root, 'tools/mmgotool'))],
        ].filter(([, out]) => out !== null);

        // Both checkers print their warnings, then "<n> warning(s)", then their errors.
        const errorsIn = (out) => {
            const lines = out.split('\n');
            return lines.slice(lines.findLastIndex((line) => (/^\d+ warning\(s\)$/).test(line)) + 1).filter(Boolean).slice(0, 30).join('\n');
        };
        if (failures.length) {
            abort(failures.map(([name, out]) => `${name} failed:\n${errorsIn(out)}`).join('\n'));
        }
    }

    // 5. The baseline.
    const baseline = readBaseline(tree);
    for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
        for (const [locale, l] of Object.entries(locales)) {
            const outstanding = Object.values(l.items).filter((item) => item.kind !== 'repair').length;
            if (payloads[locale] || !outstanding) {
                baseline[surface][locale] = plan.base;
            } else {
                (behind[locale] ||= {})[surface] = outstanding;
            }
        }
    }
    write(BASELINE, serializeBaseline(baseline));

    writeOutputs();
} catch (e) {
    abort(e.stack || String(e));
}
console.log(`\n${originals.size} files changed. Report: ${p.report}. Notes: ${p.notes}`);

// pruned.json, the report and notes.md, written before anything is kept, so
// that a run whose report could not be written is restored with the rest.
function writeOutputs() {
    writeJSON(p.pruned, pruned);
    const notes = formatNotes(Object.fromEntries(Object.entries(results).map(([locale, r]) => [locale, r.notes])));
    const report = formatReport(notes.counts);
    fs.writeFileSync(p.report, report);
    fs.writeFileSync(p.notes, notes.text);
    console.log(report);
}

// The report: what a reviewer, who reads few of these languages, can check.
// It stays short whatever the size of the run: counts per locale, the locales
// left for the next run, and how many notes of each kind notes.md holds.
function formatReport(noteCounts) {
    const acknowledgedBy = Object.fromEntries(Object.entries(results).map(([locale, r]) => [locale, r.acknowledged.length]));
    const lines = [`Translation run against ${plan.base}.`, ''];
    lines.push('| Locale | New | Changed: rewritten | Changed: kept | Repaired | Repair: no action | Acknowledged | Carried | Pruned |', '|---|---|---|---|---|---|---|---|---|');
    for (const locale of Object.keys(tally).sort()) {
        const t = tally[locale];
        if (Object.values(t).some(Boolean)) {
            lines.push(`| ${locale} | ${t.new} | ${t.rewritten} | ${t.kept} | ${t.repaired} | ${t.untouched} | ${acknowledgedBy[locale] || 0} | ${t.carried} | ${t.pruned} |`);
        }
    }
    if (Object.keys(behind).length) {
        lines.push('', 'Not brought up to date, so their baseline stays where it was:', '');
        for (const [locale, s] of Object.entries(behind).sort()) {
            lines.push(`- ${locale}: ${Object.entries(s).map(([surface, n]) => `${n} ${surface}`).join(', ')}`);
        }
    }

    const counts = Object.entries(noteCounts).map(([kind, n]) => `${n} ${kind}`);
    if (counts.length) {
        lines.push('', `The translators' notes, by kind, are in notes.md: ${counts.join(', ')} string(s).`);
    }
    return lines.join('\n') + '\n';
}
