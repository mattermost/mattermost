// The two catalog surfaces.
//
// webapp  webapp/channels/src/i18n/<locale>.json  {"<key>": "<ICU message>"}, keys
//         in code-point order. en.json is {"<key>": {defaultMessage, description}}.
// server  server/i18n/<locale>.json  [{"id", "translation"}], in no particular
//         order; a translation is a string or a map of plural forms. en.json
//         entries also carry a description.

export const GLOSSARY_DIR = 'i18n/glossary';
export const STYLE = 'i18n/style.json';

// A server plural map is checked as all of its forms at once.
export function flatten(value) {
    return value && typeof value === 'object' ? Object.values(value).join('\n') : String(value ?? '');
}
