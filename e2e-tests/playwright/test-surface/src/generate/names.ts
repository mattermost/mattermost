// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TestIdRole} from '../../lint/grammar.js';
import {ROLE_TABLE} from '../role_table.ts';

/** `join_leave_messages` -> `joinLeaveMessages` */
export function camel(s: string): string {
    const p = pascal(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

/** `join_leave_messages` -> `JoinLeaveMessages`; `access-rules` -> `AccessRules`; `9am` -> `N9am` */
export function pascal(s: string): string {
    const out = s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    return (/^[0-9]/).test(out) ? 'N' + out : out;
}

/** `recaps.recap.delete_modal` -> `RecapsRecapDeleteModal` */
export function scopeName(scope: string): string {
    return scope.split('.').map(pascal).join('');
}

/** The role in member names: `Button` in `saveButton`; nothing for an element without a role. */
export function roleWord(role: TestIdRole | null): string {
    return role ? ROLE_TABLE[role].word : '';
}

/**
 * Names a generated member may not take: the runtime `Scope`'s own members, the own element's getter, and a form's
 * methods. A testid that would produce one is an error, never renamed.
 */
export const RESERVED_MEMBERS: ReadonlySet<string> = new Set(['page', 'scope', 'root', 'bind', 'locator', 'part', 'keyed', 'list', 'partList', 'own', 'item', 'fileInput', 'container', 'fill', 'read', 'constructor']);

export const isIdentifier = (s: string) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/).test(s);

/** Words a parameter can't be named in strict-mode TypeScript. */
const RESERVED_WORDS: ReadonlySet<string> = new Set([
    'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'enum', 'eval', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
    'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static',
    'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

/** A parameter named for a testid word: the word itself, or `<word>Key` when the word is reserved. */
export const paramName = (word: string) => (RESERVED_WORDS.has(word) ? `${word}Key` : word);

/** A property key, quoted when it isn't an identifier. */
export function propKey(s: string): string {
    return isIdentifier(s) || (/^(0|[1-9][0-9]*)$/).test(s) ? s : JSON.stringify(s);
}

/** A string literal in generated code: single-quoted, escaped. */
export function str(s: string): string {
    return `'${JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
}

/** `MFAPage` -> `mfaPage`, `ChannelsPage` -> `channelsPage` */
export function pageGetter(cls: string): string {
    const lead = (/^[A-Z]+(?=[A-Z][a-z]|$)/).exec(cls)?.[0] ?? cls.charAt(0);
    return lead.toLowerCase() + cls.slice(lead.length);
}

/** Text safe inside a `/** … *\/` comment. */
export function docText(s: string): string {
    return s.replace(/\*\//g, '*\\/');
}
