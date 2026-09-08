// Bring the shipped locale catalogs into line with en.json, and fill in whatever
// translations the agents produced.
//
//   node apply_translations.mjs <workdir> [repo-root]
//
// Reads every <workdir>/translations/<locale>.json of the shape
//   {"webapp": {"<key>": "<translation>"}, "server": {"<id>": "<translation>"}}
//
// Every catalog on both surfaces goes through the same four phases, whatever the
// payload happens to contain -- so running it with no payload at all is the
// pre-flight sync, and running it with payloads is the apply:
//
//   a) add    the translations the payload supplies
//   b) seed   every remaining en.json key as "", so it is present but untranslated
//   c) sort   with the same comparator that orders en.json for that surface
//   d) prune  the keys en.json no longer has
//
// The point of (b) is that afterwards a catalog holds exactly en.json's keys and
// nothing else, so "untranslated" is a value rather than a shape: an empty string
// is the gap, and build_manifest.mjs reads it straight off the catalog per locale.
// The empty string is safe to leave in a working tree -- react-intl treats it as
// falsy and falls back to the English defaultMessage, and go-i18n's newTemplate("")
// yields a nil template so bundle.translate() returns the id -- which is to say it
// renders exactly as an absent key does. It is not safe to *ship*, and both
// checkers reject it for that reason.
//
// An existing translation is never overwritten, so re-running is safe. Pruning is
// simply how a key retired from en.json leaves the catalogs -- it needs no flag and
// is not an error -- but it is counted and named in the summary, and the entries it
// drops are written to <workdir>/pruned/<locale>.json so a rename can be traced
// back to the translation it orphaned.
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

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

// The two surfaces do not order en.json the same way, so each brings its own
// comparator rather than inheriting en.json's literal array order. webapp reuses
// the formatter that generates en.json (case-insensitive, '_' before '.');
// server matches mmgotool's `result[i].Id < result[j].Id` in
// tools/mmgotool/commands/i18n.go, which is plain and case-sensitive.
const formatterPath = `${ROOT}/webapp/channels/scripts/formatter.js`;
if (!fs.existsSync(formatterPath)) {
    console.error(`missing ${formatterPath} — webapp catalogs are sorted with its comparator`);
    process.exit(2);
}
const {compareMessages} = await import(pathToFileURL(formatterPath).href);

const SURFACES = {
    webapp: {
        dir: `${ROOT}/webapp/channels/src/i18n`,
        list: false,
        cmp: (a, b) => compareMessages({key: a}, {key: b}),
    },
    server: {
        dir: `${ROOT}/server/i18n`,
        list: true,
        cmp: (a, b) => (a < b ? -1 : (a > b ? 1 : 0)),
    },
};

// Exactly the empty string, not whitespace: " " is a legitimate translation in a
// language that separates where English uses a word, and the checkers draw the
// line in the same place.
const untranslated = (v) => v === undefined || v === '';

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

const skipped = [];
const stats = {};
const pruned = {};

for (const [surface, cfg] of Object.entries(SURFACES)) {
    const enRaw = JSON.parse(fs.readFileSync(`${cfg.dir}/en.json`, 'utf8'));
    const enSet = new Set(cfg.list ? enRaw.map((e) => e.id) : Object.keys(enRaw));

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

    const st = {
        catalogs: locales.length,
        added: 0,
        addedKeys: new Set(),
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

        // (b) seed
        for (const k of enSet) {
            if (map.has(k)) continue;
            map.set(k, '');
            st.seeded++;
        }

        // (c) sort, then (d) prune
        const kept = [];
        const dropped = {};
        for (const k of [...map.keys()].sort(cfg.cmp)) {
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
    row('seeded', st.seeded, st.seeded ? 'keys added as "" — present but untranslated' : '');
    row('sorted', st.reordered, st.reordered ? 'catalogs reordered' : 'already in en.json order');
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
