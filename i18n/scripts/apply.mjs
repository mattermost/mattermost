// Apply a plan and its payloads to the catalogs, and advance the baseline.
//
//   node i18n/scripts/apply.mjs <workdir> [--no-verify]
//
// In order, all or nothing:
//
//   1. refuse a plan the repository has moved away from since plan.mjs wrote it
//   2. validate every payload; any error applies nothing
//   3. for every catalog, whatever the payloads hold: prune the keys en.json no
//      longer has, carry renamed keys, and write the payload's answers
//   4. run both CI checkers over the result, and restore every file if either
//      fails. --no-verify skips this, for the pipeline's own tests.
//   5. advance i18n/baseline.json to the plan's base for each surface and locale
//      with nothing left to do: one with a payload, or a worklist of repairs at
//      most. A locale left out keeps its baseline, so the next plan finds the
//      same work again.
//
// Writes <workdir>/report.md, a summary for the pull request, and
// <workdir>/pruned.json, the translations pruning removed.
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {parseArgs} from 'util';

import {BASELINE, catalogPath, parseCatalog, readBaseline, serializeBaseline, serializeCatalog, SURFACES} from './lib/catalogs.mjs';
import {workingTree} from './lib/repo.mjs';
import {validatePayload} from './lib/validate.mjs';
import {digest, paths, PLAN_VERSION, readJSON, writeJSON} from './lib/workdir.mjs';

const usage = 'usage: node i18n/scripts/apply.mjs <workdir> [--no-verify]';
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
    console.error(`no plan in ${workdir}: run plan.mjs first`);
    process.exit(2);
}
const plan = readJSON(p.plan);
if (plan.version !== PLAN_VERSION) {
    console.error(`${p.plan} was written by another version of plan.mjs; plan again`);
    process.exit(2);
}
const root = plan.root;
const tree = workingTree(root);

// 1. The plan was computed from files that are still the files.
if (digest(tree) !== plan.digest) {
    console.error('the catalogs, en.json or i18n/baseline.json changed since this plan was made; plan again');
    process.exit(1);
}

// 2. Every payload, before anything is written.
const payloads = {};
const results = {};
if (fs.existsSync(p.translations)) {
    for (const f of fs.readdirSync(p.translations).filter((x) => x.endsWith('.json')).sort()) {
        const locale = path.basename(f, '.json');
        try {
            payloads[locale] = readJSON(path.join(p.translations, f));
        } catch (e) {
            console.error(`${locale}: cannot read ${f}: ${e.message}`);
            process.exit(1);
        }
    }
}
let invalid = 0;
for (const [locale, payload] of Object.entries(payloads)) {
    if (!Object.values(plan.surfaces).some(({locales}) => locales[locale])) {
        console.error(`${locale}: a payload for a locale with no catalog`);
        invalid++;
        continue;
    }
    results[locale] = validatePayload({plan, locale, payload, tree});
    if (results[locale].errors.length) {
        invalid++;
        console.error(`${locale}: ${results[locale].errors.length} error(s), for example:\n  ${results[locale].errors.slice(0, 5).join('\n  ')}`);
    }
}
if (invalid) {
    console.error('\nnothing applied. See every error with: node i18n/scripts/validate.mjs <workdir> <locale>');
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
    for (const [file, text] of originals) {
        fs.writeFileSync(file, text);
    }
};

const pruned = {};
const tally = {};
for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
    for (const [locale, l] of Object.entries(locales)) {
        const rel = catalogPath(surface, locale);
        const {map, order} = parseCatalog(tree.read(rel), surface);
        const t = tally[locale] ||= {new: 0, rewritten: 0, kept: 0, repaired: 0, carried: 0, pruned: 0};

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
                t.repaired++;
            } else if (JSON.stringify(value) === JSON.stringify(item.current)) {
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
    if (failures.length) {
        restore();
        for (const [name, out] of failures) {
            console.error(`${name} failed:\n${out.split('\n').filter((line) => line && !/warning|horizontal arrow|missing key|missing id|has no .* form/.test(line)).slice(0, 30).join('\n')}`);
        }
        console.error('\nevery catalog is restored; nothing applied');
        process.exit(1);
    }
}

// 5. The baseline.
const baseline = readBaseline(tree);
const behind = {};
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

if (Object.keys(pruned).length) {
    writeJSON(p.pruned, pruned);
}

// The report: what a reviewer, who reads few of these languages, can check.
const lines = [`Translation run against ${plan.base}.`, ''];
lines.push('| Locale | New | Changed: rewritten | Changed: kept | Repaired | Carried | Pruned |', '|---|---|---|---|---|---|---|');
for (const locale of Object.keys(tally).sort()) {
    const t = tally[locale];
    if (Object.values(t).some(Boolean)) {
        lines.push(`| ${locale} | ${t.new} | ${t.rewritten} | ${t.kept} | ${t.repaired} | ${t.carried} | ${t.pruned} |`);
    }
}
if (Object.keys(behind).length) {
    lines.push('', 'Not brought up to date, so their baseline stays where it was:', '');
    for (const [locale, s] of Object.entries(behind).sort()) {
        lines.push(`- ${locale}: ${Object.entries(s).map(([surface, n]) => `${n} ${surface}`).join(', ')}`);
    }
}
const acknowledged = Object.entries(results).flatMap(([locale, r]) => r.acknowledged.map((a) => ({locale, ...a})));
if (acknowledged.length) {
    lines.push('', 'Acknowledged by the translator:', '');
    for (const a of acknowledged) {
        lines.push(`- ${a.locale} \`${a.ref}\` (${a.rule}): ${a.reason}`);
    }
}
const notes = Object.entries(results).flatMap(([locale, r]) => Object.entries(r.notes).map(([ref, note]) => ({locale, ref, note})));
if (notes.length) {
    lines.push('', 'Notes from the translators:', '');
    for (const n of notes) {
        lines.push(`- ${n.locale} \`${n.ref}\`: ${n.note}`);
    }
}
const remaining = Object.entries(plan.surfaces.webapp.locales).
    map(([locale, l]) => [locale, l.repairsAvailable - (payloads[locale] ? Object.values(l.items).filter((i) => i.kind === 'repair').length : 0)]).
    filter(([, n]) => n > 0);
if (remaining.length) {
    lines.push('', `Repairs left for later runs: ${remaining.map(([l, n]) => `${l} ${n}`).join(', ')}.`);
}
fs.writeFileSync(p.report, lines.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`\n${originals.size} files changed. Report: ${p.report}`);
