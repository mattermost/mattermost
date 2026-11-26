// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Check a locale's answers against its worklist.
//
// A payload is one file in <workdir>/translations/<locale>/, answering any part
// of the worklist, so translators can work on slices of it side by side:
//
//   {
//     "webapp": {"<key>": "<ICU message>"},
//     "server": {"<id>": "<text>" or {"<plural form>": "<text>"}},
//     "acknowledge": {"webapp:<key>": "<why this soft finding is right>"},
//     "notes": {"server:<id>": {"kind": "<kind>", "text": "<what a reviewer should know>"}}
//   }
//
// A note's kind says what it is about, so the report can group them: english, a
// defect in the English; description, a wrong or misleading description;
// glossary, a glossary term that is wrong or missing for the context; catalog,
// a wrong translation elsewhere in the locale's catalog; choice, a translation
// decision for the reviewer to check.
//
// It answers worklist items, and nothing else; acknowledge refers to items it
// answers, and notes to any item in the locale's worklist, so a translator can
// say why it left one out. For a changed item, the current translation is a valid
// answer: it says the translation still fits the new English. For a repair, it
// says the translation is right as it is, and no action is taken. finalize.mjs needs
// a locale's payloads together to answer every item. tree is where the
// glossary and style are read from.
import {same, SURFACES} from './catalogs.mjs';
import {readGlossary, readStyle} from './glossary.mjs';
import {checkTranslation} from './rules.mjs';

const TOP_LEVEL = new Set(['webapp', 'server', 'acknowledge', 'notes']);
export const NOTE_KINDS = ['english', 'description', 'glossary', 'catalog', 'choice'];

export function validatePayload({plan, locale, payload, tree}) {
    const errors = [];
    const acknowledged = [];
    const stats = {answered: 0, kept: 0, untouched: 0};
    const glossary = readGlossary(tree, locale);
    const style = readStyle(tree, locale);

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {errors: ['the payload is not a JSON object'], acknowledged, stats, notes: {}};
    }
    for (const k of Object.keys(payload)) {
        if (!TOP_LEVEL.has(k)) {
            errors.push(`unknown top-level field "${k}"; expected ${[...TOP_LEVEL].join(', ')}`);
        }
    }
    const acknowledge = payload.acknowledge || {};
    const notes = payload.notes || {};
    const soft = new Set();
    const failed = new Set();
    const refs = new Set();

    for (const surface of Object.keys(SURFACES)) {
        const items = plan.surfaces[surface].locales[locale]?.items || {};
        const answers = payload[surface] || {};
        for (const [k, value] of Object.entries(answers)) {
            const ref = `${surface}:${k}`;
            const item = items[k];
            if (!item) {
                errors.push(`${ref}: not in this locale's worklist`);
                continue;
            }
            refs.add(ref);
            stats.answered++;
            if (item.kind === 'changed' && same(value, item.current)) {
                stats.kept++;
            }

            // A repair returned unchanged is the translator's judgement that it
            // is right as it is. It is the catalog's own string, so it is not
            // held to the rules for new work.
            if (item.kind === 'repair' && same(value, item.current)) {
                stats.untouched++;
                continue;
            }
            for (const f of checkTranslation({item, value, locale, surface, glossary, style})) {
                if (f.severity === 'error') {
                    failed.add(ref);
                    errors.push(`${ref}: ${f.message}`);
                } else if (typeof acknowledge[ref] === 'string' && acknowledge[ref].trim()) {
                    soft.add(ref);
                    acknowledged.push({ref, rule: f.rule, message: f.message, reason: acknowledge[ref].trim()});
                } else {
                    errors.push(`${ref}: ${f.message} (soft finding, ${f.rule}). If that is right, say why in "acknowledge": {"${ref}": "..."}`);
                }
            }
        }
    }

    for (const ref of Object.keys(acknowledge)) {
        if (failed.has(ref) && !soft.has(ref)) {
            errors.push(`acknowledge.${ref}: an error cannot be acknowledged; fix the translation`);
        } else if (!soft.has(ref)) {
            errors.push(`acknowledge.${ref}: nothing to acknowledge; remove it`);
        }
    }
    for (const [ref, note] of Object.entries(notes)) {
        const [surface, k] = ref.split(/:(.*)/s);
        if (!plan.surfaces[surface]?.locales[locale]?.items[k]) {
            errors.push(`notes.${ref}: not in this locale's worklist`);
        } else if (!note || typeof note !== 'object' || !NOTE_KINDS.includes(note.kind)) {
            errors.push(`notes.${ref}: not {"kind": ${NOTE_KINDS.map((kind) => `"${kind}"`).join(' | ')}, "text": "..."}`);
        } else if (typeof note.text !== 'string' || !note.text.trim()) {
            errors.push(`notes.${ref}: empty`);
        }
    }

    return {errors, acknowledged, stats, notes};
}

/**
 * One payload from several, each {file, payload}. A key answered, acknowledged
 * or noted in two files is an error, since neither answer can be preferred.
 */
export function mergePayloads(parts) {
    const errors = [];
    const merged = {};
    const seen = new Map();
    for (const {file, payload} of parts) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            errors.push(`${file}: not a JSON object`);
            continue;
        }
        for (const [field, entries] of Object.entries(payload)) {
            if (!TOP_LEVEL.has(field)) {
                merged[field] = entries;
                continue;
            }
            if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
                errors.push(`${file}: ${field} is not a JSON object`);
                continue;
            }
            merged[field] ||= {};
            for (const [k, v] of Object.entries(entries)) {
                const id = `${field}.${k}`;
                if (seen.has(id)) {
                    errors.push(`${id}: in both ${seen.get(id)} and ${file}`);
                    continue;
                }
                seen.set(id, file);
                merged[field][k] = v;
            }
        }
    }
    return {payload: merged, errors};
}

/** The worklist items a payload leaves unanswered, as surface:key. */
export function unanswered({plan, locale, payload}) {
    const out = [];
    for (const surface of Object.keys(SURFACES)) {
        const answers = payload?.[surface] || {};
        for (const k of Object.keys(plan.surfaces[surface].locales[locale]?.items || {})) {
            if (!(k in answers)) {
                out.push(`${surface}:${k}`);
            }
        }
    }
    return out;
}
