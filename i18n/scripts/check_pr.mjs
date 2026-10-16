// Check a pull request's catalog changes against where it branched.
//
//   node i18n/scripts/check_pr.mjs [--upstream origin/master | --base <rev>]
//
// Run from the repository root, with the pull request's head checked out and
// enough history to find the base, by default where HEAD leaves --upstream.
//
// Every pull request: each translation it adds or changes passes the rules a
// translation run's answers do (lib/rules.mjs), as errors; what a run would
// have to acknowledge is printed as a warning. The catalogs as they stand are
// not checked here, so a pull request is answerable only for what it changes.
//
// A pull request that moves i18n/baseline.json is a translation run, and is
// held to what plan.mjs would have given it from the base:
//
//   - it changes only catalogs, baseline.json and the glossary; in en.json,
//     only descriptions that were empty; in the glossary, only new terms
//   - it removes only keys en.json no longer has, adds only worklist keys and
//     carried renames, with the carried translation, and changes only
//     worklist keys
//   - each baseline entry it moves, it moves to the base, and only once every
//     new key for that surface and locale has a translation
import {parseArgs} from 'util';

import {BASELINE, catalogPath, GLOSSARY_DIR, isBlank, localesOf, parseCatalog, parseSource, readBaseline, same, SOURCE, SURFACES} from './lib/catalogs.mjs';
import {readGlossary, readStyle} from './lib/glossary.mjs';
import {computePlan} from './lib/plan.mjs';
import {commitTree, commitTrees, git, mergeBase, revParse, workingTree} from './lib/repo.mjs';
import {checkTranslation} from './lib/rules.mjs';

const usage = 'usage: node i18n/scripts/check_pr.mjs [--upstream <ref> | --base <rev>]';
let options;
try {
    options = parseArgs({options: {upstream: {type: 'string', default: 'origin/master'}, base: {type: 'string'}}});
} catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
}

const root = process.cwd();
const base = options.values.base ? revParse(root, options.values.base) : mergeBase(root, 'HEAD', options.values.upstream);
if (!base) {
    console.error(options.values.base ?
        `cannot resolve --base ${options.values.base}` :
        `cannot find where HEAD leaves ${options.values.upstream}; fetch it, with history (fetch-depth: 0)`);
    process.exit(2);
}

const head = workingTree(root);
const then = commitTree(root, base);
const errors = [];
const warnings = [];

const sourceDir = (surface) => `${SURFACES[surface].dir}/${SOURCE}`;
const catalogOf = (tree, surface, locale) => {
    const text = tree.read(catalogPath(surface, locale));
    return text === null ? new Map() : parseCatalog(text, surface).map;
};

// What the pull request did to each catalog: keys it added, changed and removed.
const changes = {};
for (const surface of Object.keys(SURFACES)) {
    changes[surface] = {};
    for (const locale of localesOf(head, surface)) {
        const before = catalogOf(then, surface, locale);
        const after = catalogOf(head, surface, locale);
        const c = {added: [], changed: [], removed: []};
        for (const [k, v] of after) {
            if (!before.has(k)) {
                c.added.push(k);
            } else if (!same(before.get(k), v)) {
                c.changed.push(k);
            }
        }
        c.removed = [...before.keys()].filter((k) => !after.has(k));
        changes[surface][locale] = {...c, before, after};
    }
}

// Every pull request: what it writes is held to the rules for new work.
for (const surface of Object.keys(SURFACES)) {
    const en = parseSource(head.read(sourceDir(surface)), surface);
    for (const [locale, {added, changed, after}] of Object.entries(changes[surface])) {
        const glossary = readGlossary(head, locale);
        const style = readStyle(head, locale);
        for (const k of [...added, ...changed]) {
            const value = after.get(k);
            if (!en.has(k) || isBlank(value)) {
                continue;
            }
            for (const f of checkTranslation({item: en.get(k), value, locale, surface, glossary, style})) {
                (f.severity === 'error' ? errors : warnings).push(`${catalogPath(surface, locale)}: ${k}: ${f.message}`);
            }
        }
    }
}

// A base with no baseline is before the pipeline existed: nothing to hold a run to.
const baselineMoved = then.read(BASELINE) !== null && head.read(BASELINE) !== then.read(BASELINE);
if (baselineMoved) {
    checkRun();
}

function checkRun() {
    const fail = (message) => errors.push(`translation run: ${message}`);

    const allowed = (file) => file === BASELINE ||
        Object.values(SURFACES).some(({dir}) => file.startsWith(`${dir}/`) && file.endsWith('.json') && !file.slice(dir.length + 1).includes('/')) ||
        (file.startsWith(`${GLOSSARY_DIR}/`) && file.endsWith('.json'));
    for (const file of git(root, 'diff', '--name-only', base).split('\n').filter(Boolean)) {
        if (!allowed(file)) {
            fail(`${file}: a run changes only the catalogs, ${BASELINE} and ${GLOSSARY_DIR}/`);
        }
    }

    for (const surface of Object.keys(SURFACES)) {
        const before = parseSource(then.read(sourceDir(surface)), surface);
        const after = parseSource(head.read(sourceDir(surface)), surface);
        for (const k of new Set([...before.keys(), ...after.keys()])) {
            const b = before.get(k);
            const a = after.get(k);
            if (!a || !b) {
                fail(`${sourceDir(surface)}: ${k}: ${a ? 'added' : 'removed'}; a run never changes the English`);
            } else if (!same(a.english, b.english)) {
                fail(`${sourceDir(surface)}: ${k}: the English changed; a run never changes the English`);
            } else if (a.description !== b.description && b.description.trim()) {
                fail(`${sourceDir(surface)}: ${k}: a run writes only descriptions that were empty, and this one was not`);
            }
        }
    }

    const files = new Set([...then.list(GLOSSARY_DIR), ...head.list(GLOSSARY_DIR)].filter((f) => f.endsWith('.json')));
    for (const f of files) {
        const file = `${GLOSSARY_DIR}/${f}`;
        const b = JSON.parse(then.read(file) ?? '{}');
        const a = JSON.parse(head.read(file) ?? '{}');
        for (const [term, entry] of Object.entries(b)) {
            if (!(term in a)) {
                fail(`${file}: "${term}" removed; a run only adds terms`);
            } else if (JSON.stringify(a[term]) !== JSON.stringify(entry)) {
                fail(`${file}: "${term}" changed; a run only adds terms, and a correction is a pull request of its own`);
            }
        }
    }

    let plan;
    try {
        plan = computePlan({tree: then, history: commitTrees(root), base, maxRepairs: Infinity});
    } catch (e) {
        fail(e.message);
        return;
    }

    const was = readBaseline(then);
    const now = readBaseline(head);
    for (const surface of Object.keys(SURFACES)) {
        for (const locale of new Set([...Object.keys(was[surface]), ...Object.keys(now[surface])])) {
            const from = was[surface][locale];
            const to = now[surface][locale];
            if (from === to) {
                continue;
            }
            if (!to) {
                fail(`${BASELINE}: ${surface}/${locale} removed`);
            } else if (to !== base) {
                fail(`${BASELINE}: ${surface}/${locale} moved to ${to}, but a run moves it to its base, ${base}`);
            } else {
                const after = changes[surface][locale]?.after || new Map();
                const unanswered = Object.entries(plan.surfaces[surface].locales[locale]?.items || {}).
                    filter(([k, item]) => item.kind === 'new' && isBlank(after.get(k))).
                    map(([k]) => k);
                if (unanswered.length) {
                    fail(`${BASELINE}: ${surface}/${locale} moved, but ${unanswered.length} new key(s) have no translation, such as ${unanswered.slice(0, 3).join(', ')}`);
                }
            }
        }
    }

    for (const [surface, byLocale] of Object.entries(changes)) {
        for (const [locale, {added, changed, removed, before, after}] of Object.entries(byLocale)) {
            const l = plan.surfaces[surface].locales[locale];
            const where = catalogPath(surface, locale);
            if (!l) {
                if (added.length || changed.length || removed.length) {
                    fail(`${where}: a catalog the base does not have; adding a locale is a pull request of its own`);
                }
                continue;
            }
            for (const k of removed) {
                if (!(k in l.prune)) {
                    fail(`${where}: ${k} removed, but en.json still has it`);
                }
            }
            for (const k of [...added, ...changed]) {
                if (l.carry[k]) {
                    if (!same(after.get(k), before.get(l.carry[k]))) {
                        fail(`${where}: ${k} is a rename of ${l.carry[k]}, whose translation it carries as it is`);
                    }
                } else if (!l.items[k]) {
                    fail(`${where}: ${k} changed, but it is not in this locale's worklist`);
                }
            }
        }
    }
}

for (const w of warnings) {
    console.log(`warning: ${w}`);
}
for (const e of errors) {
    console.error(`error: ${e}`);
}
const touched = Object.values(changes).flatMap((byLocale) => Object.values(byLocale)).reduce((n, c) => n + c.added.length + c.changed.length + c.removed.length, 0);
console.log(`\n${touched} catalog entries changed since ${base}${baselineMoved ? ', checked as a translation run' : ''}: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
