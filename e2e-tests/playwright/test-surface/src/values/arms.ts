// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import type {Value} from './types.ts';

import {enclosingFunction, peelNot, strip} from '../ast.ts';
import type {Loc} from '../manifest_types.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** A condition's identity: the declaration of the value it tests, plus the string literal of a strict comparison. */
export type ArmKey = {key: string; negate: boolean; origin: string; reference?: ts.Expression; literal?: string};

/** What arm identities need: the checker, source locations, and whether a condition still holds at a site. */
export type ArmDeps = {
    ix: Pick<ProgramIndex, 'checker' | 'where'>;
    stable: (condition: ts.Expression, site: ts.Node) => boolean;
};

/**
 * Identities of conditional arms across expressions, and the conditions each arm was taken under, so a later read
 * of the same stable reference (a tag's `type`, a guard around a site) can tell which arm it is in.
 */
export class ArmKeys {
    private readonly deps: ArmDeps;

    /** The condition expression behind each arm origin a key was taken at. */
    private readonly armConditions = new Map<string, ts.Expression>();

    constructor(deps: ArmDeps) {
        this.deps = deps;
    }

    /** The condition an arm key was taken at, by its origin. */
    conditionAt(origin: Loc): ts.Expression | undefined {
        return this.armConditions.get(origin);
    }

    /**
     * A condition's identity across expressions: the declaration of the value it tests (`isX`,
     * `!isX`, `props.isX`), or a stable strict comparison with a string literal, and whether it's negated.
     */
    armKey(e: ts.Expression): ArmKey | null {
        let {expr: x, negated: negate} = peelNot(e);
        let comparison: string | undefined;
        if (typescript.isBinaryExpression(x) && [typescript.SyntaxKind.EqualsEqualsEqualsToken, typescript.SyntaxKind.ExclamationEqualsEqualsToken].includes(x.operatorToken.kind)) {
            let reference = strip(x.left)!;
            let literal = strip(x.right)!;
            if (typescript.isStringLiteralLike(reference)) {
                [reference, literal] = [literal, reference];
            }
            const owner = enclosingFunction(e);
            if (!typescript.isStringLiteralLike(literal) || !owner || !this.deps.stable(e, owner.getLastToken() ?? e)) {
                return null;
            }
            comparison = literal.text;
            negate = negate !== (x.operatorToken.kind === typescript.SyntaxKind.ExclamationEqualsEqualsToken);
            x = reference;
        }
        if (!typescript.isIdentifier(x) && !typescript.isPropertyAccessExpression(x)) {
            return null;
        }
        const path: string[] = [];
        let root: ts.Expression = x;
        while (typescript.isPropertyAccessExpression(root)) {
            path.unshift(root.name.text);
            root = strip(root.expression) as ts.Expression;
        }
        if (!typescript.isIdentifier(root) && root.kind !== typescript.SyntaxKind.ThisKeyword) {
            return null;
        }
        const decl = typescript.isIdentifier(root) ? this.deps.ix.checker.getSymbolAtLocation(root)?.declarations?.[0] : enclosingFunction(e);
        if (!decl) {
            return null;
        }

        // a property is one value only within one component's render: key it by the enclosing function too
        const fn = comparison !== undefined || typescript.isPropertyAccessExpression(x) ? enclosingFunction(e) : null;
        const key = `${decl.getSourceFile().fileName}:${decl.pos}:${JSON.stringify(path)}${fn ? `@${fn.pos}` : ''}${comparison === undefined ? '' : `===${JSON.stringify(comparison)}`}`;
        const origin = this.deps.ix.where(e);
        this.armConditions.set(origin, e);
        return {key, negate, origin, ...(comparison === undefined ? {} : {reference: x, literal: comparison})};
    }

    /** Truth of the same stable reference in a resolved conditional tag arm. */
    branchTruth(expression: ts.Expression, branch: Value, site: ts.Node): boolean | 'unstable' | null {
        const identity = this.armKey(expression);
        if (!identity) {
            return null;
        }
        const arm = branch.arms?.find((item) => item.key === identity.key);
        const origins = arm?.origins;
        const stable = origins?.length && origins.every((origin) => {
            const condition = this.armConditions.get(origin);
            return condition && this.deps.stable(condition, site);
        });
        if (!arm) {
            return null;
        }
        return stable ? arm.when !== identity.negate : 'unstable';
    }
}
