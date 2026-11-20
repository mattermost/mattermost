// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';

/** One line of a Playwright aria snapshot, with its children (YAML indentation). */
export type SnapNode = {role: string; name: string | null; line: string; children: SnapNode[]};

export type RoleName = {role: string; name: string};

export const INTERACTIVE_ROLES = new Set([
    'button',
    'checkbox',
    'combobox',
    'link',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'textbox',
    'treeitem',
]);

const LANDMARK_ROLES = new Set([
    'alertdialog',
    'application',
    'banner',
    'complementary',
    'dialog',
    'form',
    'main',
    'navigation',
    'region',
]);

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const WEEKDAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';

/** Volatile text: server ids, clock times, dates and relative days. Roles, names and state flags are kept. */
const VOLATILE: Array<[RegExp, string]> = [
    [/\b[a-z0-9]{26}\b/g, '<id>'],
    [/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\b/g, '<time>'],
    [new RegExp(`\\b(?:${MONTHS}) \\d{1,2}(?:, \\d{4})?\\b`, 'g'), '<date>'],
    [new RegExp(`\\b(?:${WEEKDAYS})\\b`, 'g'), '<weekday>'],
    [/\b(?:Today|Yesterday)\b/g, '<day>'],
    [/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, '<date>'],

    // One-shot screen-reader announcement that lingers until the composer re-renders (advanced_text_editor.tsx).
    [/Login Successful ?/g, ''],
];

function scrub(text: string): string {
    return VOLATILE.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/** Splits a snapshot entry into its key (`role "name" [flags]`) and the text after the colon. */
function splitEntry(entry: string): {key: string; rest: string} {
    if (entry.startsWith("'")) {
        let i = 1;
        let key = '';
        while (i < entry.length) {
            if (entry[i] === "'" && entry[i + 1] === "'") {
                key += "'";
                i += 2;
            } else if (entry[i] === "'") {
                break;
            } else {
                key += entry[i++];
            }
        }
        return {key, rest: entry.slice(i + 1)};
    }
    let inQuotes = false;
    for (let i = 0; i < entry.length; i++) {
        if (entry[i] === '\\') {
            i++;
        } else if (entry[i] === '"') {
            inQuotes = !inQuotes;
        } else if (entry[i] === ':' && !inQuotes) {
            return {key: entry.slice(0, i), rest: entry.slice(i)};
        }
    }
    return {key: entry, rest: ''};
}

function parseKey(key: string): {role: string; name: string | null} {
    const match = /^([a-z][a-z-]*)(?: "((?:[^"\\]|\\.)*)")?/.exec(key);
    if (!match) {
        return {role: key, name: null};
    }
    return {role: match[1], name: match[2] === undefined ? null : match[2].replace(/\\(.)/g, '$1')};
}

export function parseSnapshot(yaml: string): SnapNode[] {
    const root: SnapNode = {role: 'root', name: null, line: '', children: []};
    const stack: Array<{indent: number; node: SnapNode}> = [{indent: -1, node: root}];
    for (const raw of yaml.split('\n')) {
        const match = /^(\s*)- (.*)$/.exec(raw);
        if (!match) {
            continue;
        }
        const indent = match[1].length;
        const {key} = splitEntry(match[2]);
        const node: SnapNode = {...parseKey(key), line: match[2], children: []};
        while (stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        stack[stack.length - 1].node.children.push(node);
        stack.push({indent, node});
    }
    return root.children;
}

function isUnreadSeparator(node: SnapNode): boolean {
    return (
        node.role === 'listitem' &&
        node.children.some((c) => c.role === 'separator') &&
        node.children.some((c) => /^text: New Messages$/.test(c.line))
    );
}

function filterNodes(nodes: SnapNode[]): SnapNode[] {
    return nodes
        .filter((n) => n.role !== 'tooltip' && !isUnreadSeparator(n))
        .map((n) => ({...n, line: scrub(n.line), children: filterNodes(n.children)}))
        .filter((n) => !/^text:\s*$/.test(n.line));
}

function serialize(nodes: SnapNode[], depth = 0): string[] {
    return nodes.flatMap((n) => [`${'  '.repeat(depth)}- ${n.line}`, ...serialize(n.children, depth + 1)]);
}

/** Drops tooltips and unread separators, scrubs volatile text, and re-serializes deterministically. */
export function normalizeSnapshot(yaml: string): string {
    return serialize(filterNodes(parseSnapshot(yaml))).join('\n');
}

export function stateKey(pathname: string, normalized: string): string {
    const digest = crypto.createHash('sha256').update(`${pathname}\n${normalized}`).digest('hex');
    return `s${digest.slice(0, 8)}`;
}

export function walk(nodes: SnapNode[], visit: (n: SnapNode) => void) {
    for (const n of nodes) {
        visit(n);
        walk(n.children, visit);
    }
}

/** Every named role in the snapshot with its occurrence count, sorted. */
export function roleNameCounts(nodes: SnapNode[]): Array<RoleName & {count: number}> {
    const counts = new Map<string, number>();
    walk(nodes, (n) => {
        if (n.name !== null && n.role !== 'text') {
            const key = JSON.stringify([n.role, n.name]);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    });
    return [...counts.entries()]
        .map(([key, count]) => {
            const [role, name] = JSON.parse(key) as [string, string];
            return {role, name, count};
        })
        .sort(compareRoleName);
}

/** Code-unit order, independent of locale. */
export function compareStrings(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

export function compareRoleName(a: RoleName, b: RoleName): number {
    return compareStrings(a.role, b.role) || compareStrings(a.name, b.name);
}

export function describe(rn: RoleName): string {
    return `${rn.role} "${printable(rn.name)}"`;
}

/** Icon-font glyphs (private use area) are shown as code points so traces stay readable. */
export function printable(text: string): string {
    return text.replace(/[\u{e000}-\u{f8ff}\u{f0000}-\u{10ffff}]/gu, (c) => `\\u{${c.codePointAt(0)!.toString(16)}}`);
}

/** Name with icon glyphs and surrounding whitespace removed, for near-match reporting only. */
export function stripGlyphs(text: string): string {
    return text
        .replace(/[\u{e000}-\u{f8ff}\u{f0000}-\u{10ffff}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

type Landmark = {label: string; body: string};

function topLandmarks(nodes: SnapNode[]): Landmark[] {
    const found: Landmark[] = [];
    const visit = (list: SnapNode[]) => {
        for (const n of list) {
            if (LANDMARK_ROLES.has(n.role) && n.name !== null) {
                found.push({label: describe({role: n.role, name: n.name}), body: serialize(n.children).join('\n')});
            } else {
                visit(n.children);
            }
        }
    };
    visit(nodes);
    return found;
}

/** Human-readable effects of one action, from the before/after snapshots and pathnames. */
export function classifyTransition(
    before: {pathname: string; normalized: string},
    after: {pathname: string; normalized: string},
): string[] {
    const changes: string[] = [];
    const a = topLandmarks(parseSnapshot(before.normalized));
    const b = topLandmarks(parseSnapshot(after.normalized));
    const aLabels = new Map(a.map((l) => [l.label, l.body]));
    const bLabels = new Map(b.map((l) => [l.label, l.body]));
    for (const l of b) {
        if (!aLabels.has(l.label)) {
            changes.push(`${l.label} appeared`);
        }
    }
    for (const l of a) {
        if (!bLabels.has(l.label)) {
            changes.push(`${l.label} disappeared`);
        }
    }
    if (before.pathname !== after.pathname) {
        changes.push(`URL path changed to ${after.pathname}`);
    }
    for (const l of b) {
        const previous = aLabels.get(l.label);
        if (previous !== undefined && previous !== l.body) {
            changes.push(`${l.label} content changed`);
        }
    }
    if (changes.length === 0) {
        changes.push(before.normalized === after.normalized ? 'no-op' : 'unlabelled content changed');
    }
    return changes;
}
