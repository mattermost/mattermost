// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {attrValue, isIntrinsic, jsxAttr, strip, tagName, type JsxTag} from './ast.ts';
import {MAX_LANDING_HOPS, MAX_STYLED_HOPS} from './limits.ts';
import {publishedComponent, type PublishedParts} from './parts.ts';
import {styledTarget, type Loc, type ProgramIndex} from './program_index.ts';
import type {TextEntry} from './role_table.ts';
import {typescript} from './typescript.ts';
import type {Resolver, Value} from './values.ts';

import {TEST_ID_ROLES} from '../lint/grammar.js';

/**
 * WAI-ARIA 1.2's roles, plus the testid grammar's pseudo-roles (`togglebutton`: a button with `aria-pressed`; `text`:
 * read-only content). An explicit `role=` outside this list is an `aria` warning.
 */
export const ARIA_ROLES = [
    ...TEST_ID_ROLES,
    'none', 'presentation', 'generic', 'heading', 'paragraph', 'cell', 'columnheader', 'rowheader', 'rowgroup', 'table', 'treegrid',
    'tree', 'treeitem', 'form', 'search', 'navigation', 'main', 'banner', 'complementary', 'contentinfo', 'progressbar', 'meter',
    'scrollbar', 'log', 'marquee', 'timer', 'feed', 'group', 'article', 'document', 'application', 'toolbar', 'figure', 'note',
    'math', 'term', 'definition', 'blockquote', 'caption', 'code', 'deletion', 'insertion', 'emphasis', 'strong', 'subscript',
    'superscript', 'time', 'directory', 'mark',
] as const;

export type AriaRole = typeof ARIA_ROLES[number];

const ARIA_ROLE_SET = new Set<string>(ARIA_ROLES);

export function isAriaRole(role: string): role is AriaRole {
    return ARIA_ROLE_SET.has(role);
}

/**
 * The role a testid lands on. `role` is what the element says (an explicit `role=` may be a word outside
 * `ARIA_ROLES`, which checks report), `native` whether the tag implies it, `state` the state attributes it carries.
 */
export type Aria = {role: AriaRole | null; native: boolean; state: string[]; unresolvedRole?: true; knownRoles?: AriaRole[]};

/** Roles rendered by library components (not in the scanned program). Matched on the declaring file and export name. */
export type LibraryRole = {module: RegExp; name: string; role: AriaRole | null};

export const LIBRARY_ROLES: LibraryRole[] = [

    // @mattermost/compass-ui without test-parts.json (alpha.25 and older; MenuItem renders no role of its own).
    // A library listed in `libraries` that ships test-parts.json takes its roles from there instead.
    ...([
        ['Button', 'button'], ['IconButton', 'button'], ['Switch', 'switch'], ['Checkbox', 'checkbox'], ['Radio', 'radio'],
        ['TextInput', 'textbox'], ['TextArea', 'textbox'], ['Select', 'combobox'], ['Combobox', 'combobox'],
        ['Tabs', 'tablist'], ['Tab', 'tab'], ['Modal', 'dialog'], ['Toast', 'status'], ['MenuItem', null], ['Link', 'link'],

        // added by alpha.25
        ['CardButton', 'button'], ['TileButton', 'button'], ['EmojiButton', 'button'], ['ReactionButton', 'button'],
        ['PasswordInput', 'textbox'], ['SearchInput', 'searchbox'],

        // containers whose on* props belong to built-in controls (AdminPanel's header switch, SectionNotice's
        // buttons), so the container itself isn't the control
        ['AdminPanel', 'region'], ['SectionNotice', 'region'],
    ] as const).map(([name, role]) => ({module: /node_modules\/@mattermost\/compass-ui\//, name, role})),
    {module: /node_modules\/@mui\/material\//, name: 'MenuItem', role: 'menuitem'},
    {module: /node_modules\/@mui\/material\//, name: 'MenuList', role: 'menu'},
    {module: /node_modules\/@mui\/material\//, name: 'Button', role: 'button'},
    {module: /node_modules\/@mui\/material\//, name: 'Tab', role: 'tab'},
    {module: /node_modules\/react-select\//, name: 'Input', role: 'combobox'}, // the search input; Select gives it role='combobox'
    {module: /node_modules\/react-bootstrap\//, name: 'Modal', role: 'dialog'},
    {module: /node_modules\/react-bootstrap\//, name: 'Button', role: 'button'},
    {module: /node_modules\/(@types\/)?react-router(-dom)?\//, name: 'Link', role: 'link'},
    {module: /node_modules\/(@types\/)?react-router(-dom)?\//, name: 'NavLink', role: 'link'},
];

const INPUT_ROLES: Record<string, AriaRole | null> = {
    checkbox: 'checkbox',
    radio: 'radio',
    text: 'textbox',
    email: 'textbox',
    password: 'textbox',
    tel: 'textbox',
    url: 'textbox',
    search: 'searchbox',
    number: 'spinbutton',
    range: 'slider',
    submit: 'button',
    button: 'button',
    reset: 'button',
    file: null,
    hidden: null,
    date: 'textbox',
    time: 'textbox',
    color: null,
};

const TAG_ROLES: Record<string, AriaRole> = {
    textarea: 'textbox',
    select: 'combobox',
    img: 'img',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    tr: 'row',
    td: 'cell',
    th: 'columnheader',
    table: 'table',
    dialog: 'dialog',
    option: 'option',
    nav: 'navigation',
    form: 'form',
    progress: 'progressbar',
};

const STATE_ATTRS = ['aria-checked', 'aria-pressed', 'aria-selected', 'aria-expanded', 'aria-disabled', 'disabled', 'checked', 'value'];

export const INTERACTIVE_HANDLER = /^on(Click|Change|KeyDown|KeyUp|KeyPress|Submit|MouseDown|MouseUp|Input)$/;

export class Roles {
    private readonly ix: ProgramIndex;
    private readonly R: Resolver;
    private readonly published: PublishedParts[];

    constructor(ix: ProgramIndex, R: Resolver, published: PublishedParts[] = []) {
        this.ix = ix;
        this.R = R;
        this.published = published;
    }

    /** Literal values of an attribute at a tag, restricted to an instance's usage chain when given. */
    attrLiterals(tag: JsxTag, name: string, via?: Loc[], branch?: Value): string[] | null {
        const vals = this.R.attributeValues(tag, name, branch).filter((value) => value.k === 'lit' && compatible(value, via) && compatibleArms(value, branch));
        return vals.length ? vals.map((value) => (value as {s: string}).s) : null;
    }

    /** Implicit ARIA role of a tag known only by its text (markup written as a string): an `<a>` is a link when it has an href. */
    ofTagName(name: string, attrs = ''): Aria {
        if (name === 'a') {
            return {role: (/\bhref=/).test(attrs) ? 'link' : null, native: true, state: []};
        }
        return {role: TAG_ROLES[name] ?? null, native: name in TAG_ROLES, state: []};
    }

    /** Typing capability is independent of an explicit ARIA role on a native or editable element. */
    textEntry(tag: JsxTag, via?: Loc[], element?: string, branch?: Value): TextEntry | undefined {
        const name = element ?? tagName(tag);
        if (name === 'textarea') {
            return 'text';
        }
        if (name === 'input') {
            const values = this.R.attributeValues(tag, 'type', branch).filter((value) => compatible(value, via) && compatibleArms(value, branch));
            if (!values.length || values.some((value) => value.k !== 'absent' && value.k !== 'lit')) {
                return undefined;
            }
            const types = values.map((value) => (value.k === 'lit' ? value.s.toLowerCase() : 'text'));
            if (types.every((type) => type === 'number')) {
                return 'number';
            }
            return types.every((type) => !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type)) ? 'text' : 'none';
        }
        const editable = this.R.attributeValues(tag, 'contentEditable').filter((value) => compatible(value, via) && compatibleArms(value, branch));
        if (editable.some((value) => value.k !== 'absent' && value.k !== 'lit')) {
            return undefined;
        }
        if (editable.length && editable.every((value) => value.k === 'lit' && ['', 'true', 'plaintext-only'].includes(value.s))) {
            return 'editable';
        }
        return 'none';
    }

    /** ARIA role of an intrinsic element: explicit role, aria-pressed toggle, or the tag's implicit role. */
    ofIntrinsic(tag: JsxTag, via?: Loc[], element?: string, branch?: Value): Aria {
        const name = element ?? tagName(tag);
        const state = STATE_ATTRS.filter((s) => jsxAttr(tag, s));
        const roleValues = this.R.attributeValues(tag, 'role').filter((value) => compatible(value, via) && compatibleArms(value, branch));
        if (roleValues.some((value) => value.k !== 'absent' && value.k !== 'lit')) {
            return {role: null, native: false, state, unresolvedRole: true, knownRoles: roleValues.filter((value) => value.k === 'lit').map((value) => asWritten((value as Value & {s: string}).s))};
        }
        const explicit = this.attrLiterals(tag, 'role', via, branch);
        if (explicit && explicit.length) {
            return {role: asWritten(explicit[0]), native: false, state};
        }

        // `role={role}` that this instance doesn't pass: the element keeps its implicit role
        if (!roleValues.every((value) => value.k === 'absent')) {
            return {role: null, native: false, state};
        }
        if (name === 'button') {
            return {role: jsxAttr(tag, 'aria-pressed') ? 'togglebutton' : 'button', native: true, state};
        }
        if (name === 'a') {
            return {role: jsxAttr(tag, 'href') ? 'link' : null, native: true, state};
        }
        if (name === 'input') {
            const t = this.attrLiterals(tag, 'type', via, branch)?.[0] ?? 'text';
            return {role: t in INPUT_ROLES ? INPUT_ROLES[t] : 'textbox', native: true, state};
        }

        // `contentEditable={false}` marks a part an editor can't edit (a token chip inside it), not a textbox
        const editable = jsxAttr(tag, 'contentEditable') ?? jsxAttr(tag, 'contenteditable');
        if (editable && attrValue(editable)?.kind !== typescript.SyntaxKind.FalseKeyword) {
            return {role: 'textbox', native: false, state};
        }
        if ((/^h[1-6]$/).test(name)) {
            return {role: 'heading', native: true, state};
        }
        return {role: TAG_ROLES[name] ?? null, native: name in TAG_ROLES, state};
    }

    /** Resolve a library export through import/const aliases and styled wrappers, retaining its public name. */
    private libraryIdentity(name: ts.Expression, depth = 0): {symbol: ts.Symbol; name: string} | undefined {
        const raw = this.ix.checker.getSymbolAtLocation(name);
        if (!raw) {
            return undefined;
        }
        let exported: string | undefined;
        let symbol = raw;
        const seen = new Set<ts.Symbol>();
        while (symbol.flags & typescript.SymbolFlags.Alias) {
            if (seen.has(symbol)) {
                return undefined;
            }
            seen.add(symbol);
            for (const declaration of symbol.declarations ?? []) {
                const file = declaration.getSourceFile().fileName.split(path.sep).join('/');
                if (!exported && typescript.isExportSpecifier(declaration) && LIBRARY_ROLES.some((row) => row.module.test(file) && row.name === declaration.name.text)) {
                    exported = declaration.name.text;
                }
            }
            try {
                const target = this.ix.checker.getImmediateAliasedSymbol(symbol);
                if (!target) {
                    return undefined;
                }
                symbol = target;
            } catch {
                return undefined;
            }
        }
        const declaration = symbol.declarations?.[0];
        if (depth < MAX_STYLED_HOPS && declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
            const init = strip(declaration.initializer) as ts.Expression;
            const wrapped = styledTarget(typescript.isTaggedTemplateExpression(init) ? init.tag : init);
            if (wrapped && (typescript.isIdentifier(wrapped) || typescript.isPropertyAccessExpression(wrapped))) {
                return this.libraryIdentity(wrapped, depth + 1);
            }
            if (typescript.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & typescript.NodeFlags.Const) && (typescript.isIdentifier(init) || typescript.isPropertyAccessExpression(init))) {
                return this.libraryIdentity(init, depth + 1);
            }
        }
        const declaredName = declaration && 'name' in declaration ? (declaration as ts.NamedDeclaration).name : undefined;
        const canonical = symbol.getName() === 'default' && declaredName && typescript.isIdentifier(declaredName) ? declaredName.text : symbol.getName();
        return {symbol, name: exported ?? canonical};
    }

    /** Role of a library component tag, from the library table or an explicit role prop. */
    ofLibrary(tag: JsxTag, via?: Loc[]): Aria | null {
        const explicit = this.attrLiterals(tag, 'role', via);
        const state = STATE_ATTRS.filter((s) => jsxAttr(tag, s));
        if (explicit && explicit.length) {
            return {role: asWritten(explicit[0]), native: false, state};
        }

        // styled-components: `const Close = styled.button\`…\``; `<Close>` is a <button>, and
        // `<Wrapper as={onClick ? 'button' : 'div'}>` is the element `as` names for this instance
        const styledAs = styledElement(this.ix, tag);
        if (styledAs) {
            const as = [...new Set(this.attrLiterals(tag, 'as', via) ?? [])];
            return this.ofIntrinsic(tag, via, as.length === 1 && (/^[a-z][a-z0-9]*$/).test(as[0]) ? as[0] : styledAs);
        }

        // a library that publishes test-parts.json says where data-testid lands
        const pub = publishedComponent(this.ix, tag, this.published);
        if (pub) {
            return {role: pub.component?.role ?? null, native: false, state};
        }
        const identity = this.libraryIdentity(tag.tagName as ts.Expression);
        const file = identity?.symbol.declarations?.[0]?.getSourceFile().fileName.split(path.sep).join('/');
        const hit = file && identity ? LIBRARY_ROLES.find((row) => row.module.test(file) && row.name === identity.name) : undefined;
        return hit ? {role: hit.role, native: false, state} : null;
    }

    /** Conditional intrinsic tags keep handlers only in arms where they may be present. */
    intrinsicInteractive(tag: JsxTag, element: string, via: Loc[], branch: Value): boolean {
        if (['button', 'a', 'input', 'select', 'textarea'].includes(element)) {
            return true;
        }
        return tag.attributes.properties.some((attr) => {
            if (!typescript.isJsxAttribute(attr) || !INTERACTIVE_HANDLER.test(attr.name.getText())) {
                return false;
            }
            const expression = attrValue(attr);
            if (!expression) {
                return true;
            }
            const truth = this.R.branchTruth(expression, branch, tag);
            if (truth === 'unstable') {
                return true;
            }
            if (truth === false) {
                return false;
            }
            const values = this.R.resolveIn(expression, via).filter((value) => compatible(value, via));
            return !values.length || !values.every((value) => value.k === 'absent' || (value.k === 'lit' && ['', 'false', '0'].includes(value.s)));
        });
    }

    /** Whether an intrinsic element is something a user operates. */
    isInteractive(tag: JsxTag, via?: Loc[], branch?: Value): boolean {
        const name = isIntrinsic(tag) ? tagName(tag) : styledElement(this.ix, tag);
        if (!name) {
            return false;
        }
        if (['button', 'a', 'input', 'select', 'textarea'].includes(name)) {
            return true;
        }
        return ['onClick', 'onChange', 'onKeyDown', 'onKeyUp', 'onKeyPress', 'onSubmit', 'onMouseDown', 'onMouseUp', 'onInput'].some((name) => this.R.attributeValues(tag, name, branch).filter((value) => compatible(value, via) && compatibleArms(value, branch)).some((value) => value.k !== 'absent' && !(value.k === 'lit' && ['', 'false', '0'].includes(value.s))));
    }
}

/** An explicit `role=` as written: a word outside `ARIA_ROLES` is kept (and reported by the `aria` check), not dropped. */
export function asWritten(role: string): AriaRole {
    return role as AriaRole;
}

/** Values from opposite arms of the same condition cannot describe one landing. */
function compatibleArms(value: Value, branch?: Value): boolean {
    return !value.arms?.some((arm) => branch?.arms?.some((other) => arm.key === other.key && arm.when !== other.when));
}

/** A value applies to an instance when one usage chain is a prefix of the other (they flowed through the same usages). */
export function compatible(v: Value, via?: Loc[]): boolean {
    if (!via || !v.via) {
        return true;
    }
    const n = Math.min(via.length, v.via.length);
    for (let i = 0; i < n; i++) {
        if (via[i] !== v.via[i]) {
            return false;
        }
    }
    return true;
}

/**
 * The element a styled-components tag renders: `styled.button\`…\``, `styled.button.attrs(…)\`…\``,
 * `styled('button')\`…\``, and `styled(Other)\`…\`` where `Other` is one of those. Null for anything else
 * (including `styled(Component)`).
 */
export function styledElement(ix: ProgramIndex, tag: JsxTag): string | null {
    if (isIntrinsic(tag) || typescript.isJsxNamespacedName(tag.tagName)) {
        return null;
    }
    return styledElementOf(ix, typescript.isPropertyAccessExpression(tag.tagName) ? tag.tagName.name : tag.tagName, 0);
}

function styledElementOf(ix: ProgramIndex, ref: ts.Expression, hops: number): string | null {
    if (hops > MAX_STYLED_HOPS) {
        return null;
    }
    let sym = ix.checker.getSymbolAtLocation(ref);
    if (sym && (sym.flags & typescript.SymbolFlags.Alias)) {
        try {
            sym = ix.checker.getAliasedSymbol(sym);
        } catch {
            return null;
        }
    }
    const d = sym?.valueDeclaration;
    let e: ts.Expression | undefined = d && typescript.isVariableDeclaration(d) ? d.initializer : undefined;
    if (e && typescript.isTaggedTemplateExpression(e)) {
        e = e.tag;
    } else if (e && typescript.isCallExpression(e)) {
        e = e.expression;
    } else {
        return null;
    }
    for (let depth = 0; e && depth < MAX_LANDING_HOPS; depth++) {
        if (typescript.isPropertyAccessExpression(e)) {
            if (typescript.isIdentifier(e.expression) && e.expression.text === 'styled') {
                return e.name.text;
            }
            e = e.expression;
        } else if (typescript.isCallExpression(e)) {
            const callee: ts.Expression = e.expression;
            if (typescript.isIdentifier(callee) && callee.text === 'styled') {
                const a = e.arguments[0];
                if (a && typescript.isStringLiteralLike(a)) {
                    return a.text;
                }
                return a && typescript.isIdentifier(a) ? styledElementOf(ix, a, hops + 1) : null;
            }
            e = callee;
        } else {
            return null;
        }
    }
    return null;
}

