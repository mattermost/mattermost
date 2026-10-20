// The two catalog surfaces.
//
// webapp  webapp/channels/src/i18n/<locale>.json  {"<key>": "<ICU message>"}, keys
//         in code-point order. en.json is {"<key>": {defaultMessage, description}}.
// server  server/i18n/<locale>.json  [{"id", "translation"}], in no particular
//         order; a translation is a string or a map of plural forms. en.json
//         entries also carry a description.
export const SURFACES = {
    webapp: {dir: 'webapp/channels/src/i18n'},
    server: {dir: 'server/i18n'},
};

export const SOURCE = 'en.json';
export const GLOSSARY_DIR = 'i18n/glossary';
export const STYLE = 'i18n/style.json';

export function localesOf(tree, surface) {
    return tree.list(SURFACES[surface].dir).
        filter((f) => f.endsWith('.json') && f !== SOURCE).
        map((f) => f.slice(0, -'.json'.length)).
        sort();
}

// A server plural map is checked as all of its forms at once.
export function flatten(value) {
    return value && typeof value === 'object' ? Object.values(value).join('\n') : String(value ?? '');
}
