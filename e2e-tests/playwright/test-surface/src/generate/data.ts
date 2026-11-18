// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import {Imports, renameTypeReferences} from './imports.ts';
import {docText, isIdentifier, propKey, str} from './names.ts';

import {cmp} from '../compare.ts';
import type {SurfaceReport} from '../report_types.ts';

/** What every generated file starts with, and where it imports the runtime from. */
export type Output = {header: string; runtime: string};

/**
 * `Api`: every request the client can send, each with its literal path and its response body type. A spec names one in
 * `settle(driver, {wait: Api.X})` or `waitForApi(page, Api.X)`; `defineApi` links each to the whole catalog, against
 * which a request is matched.
 */
export function emitApi(report: SurfaceReport, out: Output): string {
    const imp = new Imports('api', out.runtime);
    const lines = Object.keys(report.operations).sort(cmp).map((op) => {
        const o = report.operations[op];

        // the body names its imports as written: each type reference to one becomes the import's local name (an alias
        // when it clashes); literals and property names are left as they are
        const locals = new Map(Object.entries(o.imports ?? {}).map(([name, module]) => [name, imp.type(name, module)]));
        const body = locals.size ? renameTypeReferences(o.body ?? 'unknown', locals) : (o.body ?? 'unknown');
        return `    ${propKey(op)}: apiOp<${body}>()({op: ${str(op)}, method: ${str(o.method)}, path: ${str(o.path)}}),`;
    });
    imp.value('apiOp');
    imp.value('defineApi');
    const file = imp.finish(`/** The requests the webapp's client can send, by operation id. */
export const Api = defineApi({
${lines.join('\n')}
});`);
    return `${out.header}
${file.imports}

${file.body}
`;
}

/** The fixed sets keys are drawn from (`ChannelSettingsTab`): each a readonly array of its members, and the union type of them. */
export function emitSets(report: SurfaceReport, out: Output): string {
    const blocks = Object.keys(report.sets).sort(cmp).map((name) => {
        const members = report.sets[name];
        const example = members.length ? `: \`${docText(str(members[0]))}\`` : '';
        return `/** The members of ${name}, as testids write them. A spec passes the literal${example}. */
export const ${name} = [${members.map(str).join(', ')}] as const;
export type ${name} = (typeof ${name})[number];`;
    });
    return `${out.header}
${blocks.length ? blocks.join('\n\n') : 'export {};'}
`;
}

type MsgNode = {leaf?: {id: string; text: string}; children: Map<string, MsgNode>};

/** ICU argument names and their value types: `{name}`, `{n, plural, …}`, `{x, select, …}`. */
export function messageParams(text: string): Map<string, string> {
    const out = new Map<string, string>();
    const visit = (s: string) => {
        let depth = 0;
        for (let i = 0; i < s.length; i++) {
            if (s[i] === "'" && (s[i + 1] === '{' || s[i + 1] === '}')) {
                const close = s.indexOf("'", i + 1);
                i = close < 0 ? s.length : close;
                continue;
            }
            if (s[i] !== '{') {
                continue;
            }
            let j = i;
            depth = 0;
            for (; j < s.length; j++) {
                if (s[j] === '{') {
                    depth++;
                } else if (s[j] === '}') {
                    depth--;
                    if (depth === 0) {
                        break;
                    }
                }
            }
            const body = s.slice(i + 1, j);
            const [name, kind] = body.split(',').map((x) => x.trim());
            if (name && isIdentifier(name)) {
                let t = 'string | number';
                if (kind === 'plural' || kind === 'selectordinal' || kind === 'number') {
                    t = 'number';
                } else if (kind === 'select') {
                    t = 'string';
                } else if (kind === 'date' || kind === 'time') {
                    t = 'Date | number';
                }
                if (!out.has(name) || t !== 'string | number') {
                    out.set(name, t);
                }
            }
            const inner = body.indexOf('{');
            if (inner >= 0) {
                visit(body.slice(inner));
            }
            i = j;
        }
    };
    visit(text);
    return out;
}

/** `Msg`: the i18n catalog as a nested object (`Msg.api.channel.join_channel.post_and_forget`). */
export function emitMsg(catalogPath: string, out: Output): string {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Record<string, string | {defaultMessage: string}>;
    const root: MsgNode = {children: new Map()};
    for (const id of Object.keys(catalog).sort()) {
        const entry = catalog[id];
        const text = typeof entry === 'string' ? entry : entry.defaultMessage;
        let n = root;
        for (const w of id.split('.')) {
            let c = n.children.get(w);
            if (!c) {
                c = {children: new Map()};
                n.children.set(w, c);
            }
            n = c;
        }
        n.leaf = {id, text};
    }
    const render = (n: MsgNode, indent: string): string => {
        const lines: string[] = [];
        for (const [k, c] of [...n.children.entries()].sort((a, b) => cmp(a[0], b[0]))) {
            if (c.leaf && !c.children.size) {
                lines.push(`${indent}${propKey(k)}: ${leaf(c.leaf)},`);
                continue;
            }
            const inner = [...(c.leaf ? [`${indent}    _: ${leaf(c.leaf)},`] : []), render(c, indent + '    ')].filter(Boolean).join('\n');
            lines.push(`${indent}${propKey(k)}: {\n${inner}\n${indent}},`);
        }
        return lines.join('\n');
    };
    const leaf = (l: {id: string; text: string}) => {
        const params = messageParams(l.text);
        const p = params.size ? `<{${[...params.entries()].map(([k, t]) => `${k}: ${t}`).join('; ')}}>` : '';
        return `msg${p}(${JSON.stringify(l.id)}, ${JSON.stringify(l.text)})`;
    };
    return `${out.header}
import {msg} from '${out.runtime}';

/**
 * The webapp's i18n catalog (en.json), so tests format what the UI renders instead of retyping English. A message
 * whose id is also a prefix of other ids is under \`_\`.
 */
export const Msg = {
${render(root, '    ')}
} as const;
`;
}
