// Check one locale's payload against its worklist.
//
// A payload is <workdir>/translations/<locale>.json:
//
//   {
//     "webapp": {"<key>": "<ICU message>"},
//     "server": {"<id>": "<text>" or {"<plural form>": "<text>"}},
//     "acknowledge": {"webapp:<key>": "<why this soft finding is right>"},
//     "notes": {"server:<id>": "<anything a reviewer should know>"}
//   }
//
// It answers every worklist item, and nothing else. For a changed item, the
// current translation is a valid answer: it says the translation still fits
// the new English.
import {same, SURFACES} from './catalogs.mjs';
import {readGlossary, readStyle} from './glossary.mjs';
import {checkTranslation} from './rules.mjs';

const TOP_LEVEL = new Set(['webapp', 'server', 'acknowledge', 'notes']);

export function validatePayload({plan, locale, payload, tree}) {
    const errors = [];
    const acknowledged = [];
    const stats = {answered: 0, kept: 0};
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
        for (const k of Object.keys(items)) {
            refs.add(`${surface}:${k}`);
            if (!(k in answers)) {
                errors.push(`${surface}:${k}: missing from the payload`);
            }
        }
        for (const [k, value] of Object.entries(answers)) {
            const ref = `${surface}:${k}`;
            const item = items[k];
            if (!item) {
                errors.push(`${ref}: not in this locale's worklist`);
                continue;
            }
            stats.answered++;
            if (item.kind === 'changed' && same(value, item.current)) {
                stats.kept++;
            }
            if (item.kind === 'repair' && same(value, item.current)) {
                errors.push(`${ref}: returned unchanged, but it is listed for repair: ${item.problems.join('; ')}`);
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
                    errors.push(`${ref}: ${f.message}. If that is right, say why in "acknowledge": {"${ref}": "..."}`);
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
        if (!refs.has(ref)) {
            errors.push(`notes.${ref}: not in this locale's worklist`);
        } else if (typeof note !== 'string' || !note.trim()) {
            errors.push(`notes.${ref}: empty`);
        }
    }

    return {errors, acknowledged, stats, notes};
}
