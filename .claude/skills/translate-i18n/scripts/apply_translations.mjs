// Bring the shipped locale catalogs into line with en.json, and fill in whatever
// translations the agents produced.
//
//   node apply_translations.mjs <workdir> [repo-root]
//
// Reads every <workdir>/translations/<locale>.json of the shape
//   {"webapp": {"<key>": "<translation>"}, "server": {"<id>": "<translation>"}}
//
// Every catalog on both surfaces goes through the same four phases, whatever the
// payload happens to contain, so running it with no payload at all is the
// pre-flight sync, and running it with payloads is the apply:
//
//   a) add    the translations the payload supplies
//   b) seed   every remaining en.json key as "", so it is present but untranslated
//   c) order  as that surface's catalogs already are, so only real changes diff
//   d) prune  the keys en.json no longer has
//
// The point of (b) is that afterwards a catalog holds exactly en.json's keys and
// nothing else, so "untranslated" is a value rather than a shape: an empty string
// is the gap, and build_manifest.mjs reads it straight off the catalog per locale.
// The empty string is safe to leave in a working tree: react-intl treats it as
// falsy and falls back to the English defaultMessage, and go-i18n's newTemplate("")
// yields a nil template so bundle.translate() returns the id, which is to say it
// renders exactly as an absent key does. It is not safe to *ship*, and both
// checkers reject it for that reason.
//
// An existing translation is never overwritten, so re-running is safe. Pruning is
// simply how a key retired from en.json leaves the catalogs (it needs no flag and
// is not an error), but it is counted and named in the summary, and the entries it
// drops are written to <workdir>/pruned/<locale>.json so a rename can be traced
// back to the translation it orphaned.
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const [workdir, rootArg] = process.argv.slice(2);
if (!workdir) {
    console.error('usage: node apply_translations.mjs <workdir> [repo-root]');
    process.exit(2);
}
if (!fs.existsSync(workdir)) {
    console.error(`missing workdir ${workdir}`);
    process.exit(2);
}
const ROOT = path.resolve(rootArg || '.');
const inDir = `${workdir}/translations`;

// Each surface keeps the order its catalogs already have, so a run's diff is only
// the entries it adds or prunes. The webapp catalogs are in code-point order,
// which check_icu.mjs enforces. The server catalogs have no order, so existing
// ids stay where they are and new ones are appended.
const SURFACES = {
    webapp: {
        dir: `${ROOT}/webapp/channels/src/i18n`,
        list: false,
        order: (keys) => [...keys].sort(),
    },
    server: {
        dir: `${ROOT}/server/i18n`,
        list: true,
        order: (keys, original) => {
            const had = new Set(original);
            return [...original.filter((k) => keys.includes(k)), ...keys.filter((k) => !had.has(k)).sort()];
        },
    },
};

// The English and description of each entry, whichever shape en.json had: the
// server's list, the webapp's {defaultMessage, description}, or the webapp's
// older flat strings, which had no description. Server translations may be
// plural maps, so compare them as JSON.
const sourceOf = (raw, list) => (list ?
    new Map(raw.map((e) => [e.id, {english: JSON.stringify(e.translation), description: e.description || ''}])) :
    new Map(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ?
        {english: v, description: ''} :
        {english: v.defaultMessage, description: v.description || ''}])));

// The source a key had before en.json dropped it, from git: HEAD when the removal
// is not committed yet, otherwise the parent of the commit that removed it. null
// when there is no history to read.
const historicSource = new Map();
function sourceBeforeRemoval(relPath, key, list) {
    const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9, stdio: ['ignore', 'pipe', 'ignore']});
    const at = (rev) => {
        const id = `${rev}:${relPath}`;
        if (!historicSource.has(id)) {
            try {
                historicSource.set(id, sourceOf(JSON.parse(git('show', id)), list));
            } catch {
                historicSource.set(id, new Map());
            }
        }
        return historicSource.get(id).get(key) ?? null;
    };
    const fromHead = at('HEAD');
    if (fromHead !== null) return fromHead;
    try {
        const removedIn = git('log', '-1', '--format=%H', `-S"${key}"`, '--', relPath).trim();
        return removedIn ? at(`${removedIn}^`) : null;
    } catch {
        return null;
    }
}

// Empty or whitespace-only, where the checkers draw the line.
const untranslated = (v) => v === undefined || (typeof v === 'string' && v.trim() === '');

const serialize = (map, keys, list) => {
    const entries = keys.map((k) => [k, map.get(k)]);
    const body = list ? entries.map(([id, translation]) => ({id, translation})) : Object.fromEntries(entries);
    return JSON.stringify(body, null, 2) + '\n';
};

const payloads = {};
if (fs.existsSync(inDir)) {
    for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.json'))) {
        payloads[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'));
    }
}

// Validate every payload before writing anything. An agent reporting that it
// checked its own output is not a check, and one bad payload should not leave
// the catalogs half-applied.
const {validate} = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'validate_translations.mjs')).href);
const invalid = Object.keys(payloads).sort().
    map((loc) => [loc, validate(workdir, loc, ROOT).errors]).
    filter(([, errs]) => errs.length);
if (invalid.length) {
    for (const [loc, errs] of invalid) {
        console.error(`${loc}: ${errs.length} error(s), e.g. ${errs[0]}`);
    }
    console.error(`\nnothing applied. Fix these, or check one locale with validate_translations.mjs <workdir> <locale>.`);
    process.exit(1);
}

const skipped = [];
const stats = {};
const pruned = {};

for (const [surface, cfg] of Object.entries(SURFACES)) {
    const enRaw = JSON.parse(fs.readFileSync(`${cfg.dir}/en.json`, 'utf8'));
    const enSet = new Set(cfg.list ? enRaw.map((e) => e.id) : Object.keys(enRaw));
    const enSource = sourceOf(enRaw, cfg.list);

    const locales = fs.readdirSync(cfg.dir).
        filter((f) => f.endsWith('.json') && f !== 'en.json').
        map((f) => path.basename(f, '.json')).
        sort();
    const have = new Set(locales);

    // A payload naming a locale this surface has no catalog for is a typo worth
    // hearing about, not something to pass over in silence.
    for (const [loc, payload] of Object.entries(payloads)) {
        if (have.has(loc)) continue;
        if (Object.keys(payload[surface] || {}).length) {
            skipped.push(`${loc}/${surface}: no catalog at ${cfg.dir}/${loc}.json`);
        }
    }

    // A key en.json dropped whose exact English now lives under exactly one key
    // some catalog lacks is a rename, not new work: carry each locale's
    // translation across rather than asking for it again. Only when the
    // description is unchanged too: a translator reads it, so a clarified
    // description can mean the old translation was of the wrong sense.
    const catalogs = new Map(locales.map((locale) => {
        const raw = JSON.parse(fs.readFileSync(`${cfg.dir}/${locale}.json`, 'utf8'));
        return [locale, cfg.list ? new Map(raw.map((e) => [e.id, e.translation])) : new Map(Object.entries(raw))];
    }));
    const byEnglish = new Map();
    for (const [k, {english}] of enSource) {
        if ([...catalogs.values()].every((m) => !untranslated(m.get(k)))) continue;
        byEnglish.set(english, [...(byEnglish.get(english) || []), k]);
    }
    const renames = new Map();
    const redescribed = new Map();
    const retired = new Set([...catalogs.values()].flatMap((m) => [...m.keys()]).filter((k) => !enSet.has(k)));
    for (const oldKey of retired) {
        const old = sourceBeforeRemoval(path.relative(ROOT, `${cfg.dir}/en.json`), oldKey, cfg.list);
        const targets = old === null ? [] : byEnglish.get(old.english) || [];
        if (targets.length !== 1) continue;
        if (enSource.get(targets[0]).description === old.description) {
            renames.set(targets[0], oldKey);
        } else {
            redescribed.set(targets[0], oldKey);
        }
    }

    const st = {
        catalogs: locales.length,
        added: 0,
        addedKeys: new Set(),
        carried: 0,
        renames,
        redescribed,
        seeded: 0,
        untranslated: 0,
        untranslatedLocales: new Set(),
        reordered: 0,
        removed: 0,
        removedKeys: new Map(),
        written: 0,
    };

    for (const locale of locales) {
        const p = `${cfg.dir}/${locale}.json`;
        const rawText = fs.readFileSync(p, 'utf8');
        const raw = JSON.parse(rawText);
        const map = cfg.list ? new Map(raw.map((e) => [e.id, e.translation])) : new Map(Object.entries(raw));
        const originalOrder = [...map.keys()];
        const originalSet = new Set(originalOrder);

        // (a) add
        for (const [k, v] of Object.entries((payloads[locale] || {})[surface] || {})) {
            if (!enSet.has(k)) { skipped.push(`${locale}/${surface}: ${k} not in en.json`); continue; }
            if (!untranslated(map.get(k))) { skipped.push(`${locale}/${surface}: ${k} already translated`); continue; }
            if (typeof v !== 'string' || !v.trim()) { skipped.push(`${locale}/${surface}: ${k} empty`); continue; }
            map.set(k, v);
            st.added++;
            st.addedKeys.add(k);
        }

        // A rename carries the old translation to the new key, unless the
        // payload already supplied one.
        for (const [newKey, oldKey] of renames) {
            if (!untranslated(map.get(newKey)) || untranslated(map.get(oldKey))) continue;
            map.set(newKey, map.get(oldKey));
            st.carried++;
        }

        // (b) seed
        for (const k of enSet) {
            if (map.has(k)) continue;
            map.set(k, '');
            st.seeded++;
        }

        // (c) order, then (d) prune
        const kept = [];
        const dropped = {};
        for (const k of cfg.order([...map.keys()], originalOrder)) {
            if (enSet.has(k)) {
                kept.push(k);
                if (untranslated(map.get(k))) {
                    st.untranslated++;
                    st.untranslatedLocales.add(locale);
                }
                continue;
            }
            dropped[k] = map.get(k);
            map.delete(k);
            st.removed++;
            st.removedKeys.set(k, (st.removedKeys.get(k) || 0) + 1);
        }
        if (Object.keys(dropped).length) {
            pruned[locale] = pruned[locale] || {};
            pruned[locale][surface] = dropped;
        }

        // Count a catalog as reordered only when keys it already held had to move
        // relative to each other; inserting a new key mid-file is not a reorder.
        const keptSet = new Set(kept);
        const wasOrdered = originalOrder.filter((k) => keptSet.has(k)).join('\n');
        const nowOrdered = kept.filter((k) => originalSet.has(k)).join('\n');
        if (wasOrdered !== nowOrdered) st.reordered++;

        const after = serialize(map, kept, cfg.list);
        if (after !== rawText) {
            fs.writeFileSync(p, after);
            st.written++;
        }
    }

    stats[surface] = st;
}

// The entries pruning dropped are the only record of what a translation used to
// say once the key is gone. Rename detection needs them; so does anyone asking
// why a locale lost a string.
const prunedDir = `${workdir}/pruned`;
if (Object.keys(pruned).length) {
    fs.mkdirSync(prunedDir, {recursive: true});
    for (const [locale, body] of Object.entries(pruned)) {
        fs.writeFileSync(`${prunedDir}/${locale}.json`, JSON.stringify(body, null, 2) + '\n');
    }
}

if (!Object.keys(payloads).length) {
    console.log(`no payloads in ${inDir} — sync only\n`);
}

const row = (label, n, note) => console.log(`  ${label.padEnd(13)}${String(n).padStart(6)}  ${note}`.trimEnd());

for (const [surface, st] of Object.entries(stats)) {
    console.log(`${surface}: ${st.catalogs} catalogs`);

    let addedNote = '';
    if (st.added) {
        addedNote = st.added === st.addedKeys.size * st.catalogs ?
            `(${st.addedKeys.size} keys x ${st.catalogs} locales)` :
            `(${st.addedKeys.size} distinct keys)`;
    }
    row('added', st.added, addedNote);
    row('carried', st.carried, st.carried ? 'translations carried across renamed keys:' : '');
    for (const [newKey, oldKey] of [...st.renames].slice(0, 8)) console.log(`     ${oldKey} -> ${newKey}`);
    if (st.renames.size > 8) console.log(`     ... and ${st.renames.size - 8} more renames`);
    if (st.redescribed.size) {
        row('not carried', st.redescribed.size, 'renames whose description changed, so translated again:');
        for (const [newKey, oldKey] of [...st.redescribed].slice(0, 8)) console.log(`     ${oldKey} -> ${newKey}`);
        if (st.redescribed.size > 8) console.log(`     ... and ${st.redescribed.size - 8} more`);
    }
    row('seeded', st.seeded, st.seeded ? 'keys added as "" — present but untranslated' : '');
    row('reordered', st.reordered, st.reordered ? 'catalogs whose existing entries moved' : 'existing order kept');
    row('removed', st.removed, st.removed ? 'not in en.json:' : '');

    if (st.removed) {
        const keys = [...st.removedKeys.entries()];
        const shown = keys.slice(0, 8);
        const width = Math.max(...shown.map(([k]) => k.length));
        for (const [k, n] of shown) console.log(`     ${k.padEnd(width)}  x${n}`);
        if (keys.length > shown.length) console.log(`     ... and ${keys.length - shown.length} more keys`);
    }

    row('untranslated', st.untranslated, st.untranslated ?
        `empty across ${st.untranslatedLocales.size} ${st.untranslatedLocales.size === 1 ? "locale" : "locales"} — this is the gap to translate` :
        'every catalog is complete');
    row('written', st.written, 'catalogs changed on disk');
    console.log('');
}

if (Object.keys(pruned).length) {
    console.log(`pruned entries recorded in ${prunedDir}/ (${Object.keys(pruned).length} locales)\n`);
}

console.log(`skipped ${skipped.length}${skipped.length ? ':' : ''}`);
skipped.slice(0, 20).forEach((x) => console.log(`  ${x}`));
if (skipped.length > 20) console.log(`  ... and ${skipped.length - 20} more`);

const outstanding = Object.values(stats).reduce((a, st) => a + st.untranslated, 0);
if (outstanding) {
    console.log(`\n${outstanding} untranslated entries remain — build the per-locale worklists:`);
    console.log(`  node .claude/skills/translate-i18n/scripts/build_manifest.mjs ${workdir}`);
} else {
    console.log('\nnow run the real checkers:');
    console.log('  cd webapp/channels && npm run i18n-verify-translations');
    console.log('  cd tools/mmgotool && go run . i18n verify --server-dir=../../server');
}
