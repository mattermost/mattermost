// The two catalog surfaces.
//
// webapp  webapp/channels/src/i18n/<locale>.json  {"<key>": "<ICU message>"}, keys
//         in code-point order. en.json is {"<key>": {defaultMessage, description}}.
// server  server/i18n/<locale>.json  [{"id", "translation"}], in no particular
//         order; a translation is a string or a map of plural forms. en.json
//         entries also carry a description.
export const SURFACES = {
    webapp: {dir: 'webapp/channels/src/i18n', list: false},
    server: {dir: 'server/i18n', list: true},
};

export const SOURCE = 'en.json';
export const BASELINE = 'i18n/baseline.json';
export const GLOSSARY_DIR = 'i18n/glossary';
export const STYLE = 'i18n/style.json';

export function localesOf(tree, surface) {
    return tree.list(SURFACES[surface].dir).
        filter((f) => f.endsWith('.json') && f !== SOURCE).
        map((f) => f.slice(0, -'.json'.length)).
        sort();
}

export function flatten(value) {
    return value && typeof value === 'object' ? Object.values(value).join('\n') : String(value ?? '');
}

// A stable string for comparing two translations, either of which may be a
// server plural map whose forms are in any order.
export function stableText(value) {
    if (value && typeof value === 'object') {
        return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]])));
    }
    return JSON.stringify(value);
}

export const same = (a, b) => stableText(a) === stableText(b);

// Empty or whitespace-only, where both checkers draw the line. A plural map is
// blank only if every form is; one blank form is the server checker's own error.
export function isBlank(value) {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value === 'string') {
        return value.trim() === '';
    }
    if (typeof value === 'object') {
        return Object.values(value).every((form) => typeof form !== 'string' || form.trim() === '');
    }
    return false;
}

export const catalogPath = (surface, locale) => `${SURFACES[surface].dir}/${locale}.json`;

/**
 * en.json as a Map of key -> {english, description}. english is a string, or on
 * the server possibly a plural map. Older webapp catalogs held bare strings and
 * no description.
 */
export function readSource(tree, surface) {
    const file = `${SURFACES[surface].dir}/${SOURCE}`;
    const text = tree.read(file);
    if (text === null) {
        throw new Error(`${file} is missing${tree.rev ? ` at ${tree.rev}` : ''}`);
    }
    const raw = JSON.parse(text);
    if (SURFACES[surface].list) {
        return new Map(raw.map((e) => [e.id, {english: e.translation, description: e.description || ''}]));
    }
    return new Map(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ?
        {english: v, description: ''} :
        {english: v.defaultMessage, description: v.description || ''}]));
}

/** A locale catalog as {map: key -> translation, order: [key...]}. */
export function parseCatalog(text, surface) {
    const raw = JSON.parse(text);
    if (SURFACES[surface].list) {
        return {map: new Map(raw.map((e) => [e.id, e.translation])), order: raw.map((e) => e.id)};
    }
    return {map: new Map(Object.entries(raw)), order: Object.keys(raw)};
}

/**
 * i18n/baseline.json: for each surface and locale, the commit whose en.json that
 * catalog was last brought fully up to date against. A locale with no entry has
 * no history to compare with, so nothing in it can be found stale.
 */
export function readBaseline(tree) {
    const text = tree.read(BASELINE);
    if (text === null) {
        return {webapp: {}, server: {}};
    }
    const raw = JSON.parse(text);
    return {webapp: raw.webapp || {}, server: raw.server || {}};
}
