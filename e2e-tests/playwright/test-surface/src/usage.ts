// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {strip, type JsxTag} from './ast.ts';
import {typescript} from './typescript.ts';

/** `React.createElement(Comp, props)`: a usage whose attributes are an object. */
export type CallUsage = {kind: 'call'; call: ts.CallExpression; props: ts.Expression | undefined};

/** A place a component is rendered: a JSX tag, or a createElement call. */
export type Usage = JsxTag | CallUsage;

export type UsageAttr = {name: string; value: ts.Expression | undefined} | {spread: ts.Expression};

export function isCallUsage(u: Usage): u is CallUsage {
    return (u as CallUsage).kind === 'call';
}

/** The node a usage is located at (for locations and render conditions). */
export function usageNode(u: Usage): ts.Node {
    return isCallUsage(u) ? u.call : u;
}

/** A usage's attributes in source order; a bare JSX attribute has no value. */
export function usageAttrs(u: Usage): UsageAttr[] {
    if (!isCallUsage(u)) {
        return u.attributes.properties.map((p) => {
            if (typescript.isJsxSpreadAttribute(p)) {
                return {spread: p.expression};
            }
            const init = p.initializer;
            const value = init && typescript.isJsxExpression(init) ? init.expression : init as ts.Expression | undefined;
            return {name: p.name.getText(), value};
        });
    }
    const props = strip(u.props) as ts.Expression | undefined;
    if (!props) {
        return [];
    }
    if (!typescript.isObjectLiteralExpression(props)) {
        return [{spread: props}];
    }
    const out: UsageAttr[] = [];
    for (const p of props.properties) {
        if (typescript.isSpreadAssignment(p)) {
            out.push({spread: p.expression});
        } else if (typescript.isPropertyAssignment(p)) {
            const name = propNameText(p.name);
            if (name) {
                out.push({name, value: p.initializer});
            }
        } else if (typescript.isShorthandPropertyAssignment(p)) {
            out.push({name: p.name.text, value: p.name});
        }
    }
    return out;
}

function propNameText(n: ts.PropertyName): string | null {
    if (typescript.isIdentifier(n) || typescript.isStringLiteral(n) || typescript.isNumericLiteral(n)) {
        return n.text;
    }
    return null;
}
