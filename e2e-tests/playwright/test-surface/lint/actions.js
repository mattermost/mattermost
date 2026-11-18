// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// What the spec rules call an action, an observation and an assertion promise. Actions are recognized by the type of
// what they are called on, so the rules need type information (parserOptions.projectService).
import ts from 'typescript';

import {OBSERVING_VERBS, PREPARING_VERBS, RETRYING_MATCHERS, VERBS} from './verbs.js';

/** Playwright's web-first matchers: they retry until they hold. */
const PLAYWRIGHT_RETRYING = [
    'toBeAttached',
    'toBeChecked',
    'toBeDisabled',
    'toBeEditable',
    'toBeEmpty',
    'toBeEnabled',
    'toBeFocused',
    'toBeHidden',
    'toBeInViewport',
    'toBeVisible',
    'toContainClass',
    'toContainText',
    'toHaveAccessibleDescription',
    'toHaveAccessibleErrorMessage',
    'toHaveAccessibleName',
    'toHaveAttribute',
    'toHaveCSS',
    'toHaveClass',
    'toHaveCount',
    'toHaveId',
    'toHaveJSProperty',
    'toHaveRole',
    'toHaveScreenshot',
    'toHaveText',
    'toHaveTitle',
    'toHaveURL',
    'toHaveValue',
    'toHaveValues',
    'toMatchAriaSnapshot',
];

export const RETRYING = new Set([...PLAYWRIGHT_RETRYING, ...RETRYING_MATCHERS]);
const ACTIONS = new Set(VERBS);
const PREPARING = new Set(PREPARING_VERBS);
const OBSERVING = new Set(OBSERVING_VERBS);
const PLAYWRIGHT_RECEIVERS = new Set(['Locator', 'Page', 'Keyboard', 'Mouse']);
const WRAPPERS = new Set(['ChainExpression', 'TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

/** The expression a wrapper (`x!`, `x as T`, `a?.b()`) stands for. */
export function unwrap(node) {
    let inner = node;
    while (inner && WRAPPERS.has(inner.type)) {
        inner = inner.expression;
    }
    return inner;
}

/** The node a wrapped expression is used by, past its wrappers. */
export function usedBy(node) {
    let child = node;
    while (child.parent && WRAPPERS.has(child.parent.type)) {
        child = child.parent;
    }
    return {child, parent: child.parent};
}

function propertyName(member) {
    if (member.type !== 'MemberExpression') {
        return null;
    }
    if (!member.computed && member.property.type === 'Identifier') {
        return member.property.name;
    }
    if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
        return member.property.value;
    }
    return null;
}

function isIdentifier(node, name) {
    return Boolean(node) && node.type === 'Identifier' && node.name === name;
}

function isPromiseCombinator(callee) {
    const member = unwrap(callee);
    return member.type === 'MemberExpression' && isIdentifier(member.object, 'Promise') && ['all', 'allSettled', 'any', 'race'].includes(propertyName(member));
}

/** The start of an assertion chain: `{kind, call, matcher}` for `expect(x).not.m()`, `expect.poll(f).m()`, `expect.soft(x).m()`. */
export function assertionOf(call) {
    const callee = unwrap(call.callee);
    const matcher = propertyName(callee);
    if (!matcher) {
        return null;
    }
    let object = unwrap(callee.object);
    while (object.type === 'MemberExpression' && ['not', 'resolves', 'rejects'].includes(propertyName(object))) {
        object = unwrap(object.object);
    }
    if (object.type !== 'CallExpression') {
        return null;
    }
    const root = unwrap(object.callee);
    if (isIdentifier(root, 'expect')) {
        return {kind: 'expect', call: object, matcher};
    }
    if (root.type === 'MemberExpression' && isIdentifier(root.object, 'expect') && ['poll', 'soft'].includes(propertyName(root))) {
        return {kind: propertyName(root), call: object, matcher};
    }
    return null;
}

/** An awaited assertion that observes: a retrying matcher on a value that is not itself awaited, `expect.poll`, `toPass`. */
export function isObservation(call) {
    const assertion = assertionOf(call);
    if (!assertion) {
        return false;
    }
    if (assertion.kind === 'poll') {
        return true;
    }
    if (assertion.kind !== 'expect') {
        return false;
    }
    if (assertion.matcher === 'toPass') {
        return true;
    }
    const actual = assertion.call.arguments[0];
    return RETRYING.has(assertion.matcher) && Boolean(actual) && unwrap(actual).type !== 'AwaitExpression';
}

/** An assertion that returns a promise to await: a retrying matcher, `expect.poll`, `toPass`. */
export function isAssertionPromise(call) {
    const assertion = assertionOf(call);
    return Boolean(assertion) && (assertion.kind === 'poll' || assertion.matcher === 'toPass' || RETRYING.has(assertion.matcher));
}

/** The type checker the rules read, or an error saying how to give them one. */
export function typeServices(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) {
        throw new Error(`${context.id} needs type information: lint the file with parserOptions.projectService`);
    }
    const checker = services.program.getTypeChecker();
    const typeOf = (node) => checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));
    const symbolOf = (node) => {
        const symbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(node));
        return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    };
    return {checker, typeOf, symbolOf};
}

/** Where Playwright's own declarations live: its packages under node_modules, not any path naming it. */
const PLAYWRIGHT_PACKAGE = /[\\/]node_modules[\\/](?:@playwright[\\/]test|playwright(?:-core)?)[\\/]/;

/** The classifier both rules share. */
export function classifier(context) {
    const {checker, typeOf} = typeServices(context);
    const services = context.sourceCode.parserServices;

    const constituents = (type) => {
        const base = type.isTypeParameter() ? (checker.getBaseConstraintOfType(type) ?? type) : type;
        return base.isUnion() ? base.types : [base];
    };
    const isPlaywright = (type, names) => {
        const symbol = type.getSymbol() ?? type.aliasSymbol;
        return Boolean(symbol) && names.has(symbol.getName()) && (symbol.getDeclarations() ?? []).some((declaration) => PLAYWRIGHT_PACKAGE.test(declaration.getSourceFile().fileName));
    };
    const propertyType = (type, name) => {
        const property = checker.getPropertyOfType(type, name);
        return property ? checker.getTypeOfSymbol(property) : null;
    };
    const isDriver = (type) => {
        const locator = propertyType(type, 'locator');
        return Boolean(locator) && Boolean(checker.getPropertyOfType(type, 'meta')) && constituents(locator).some((t) => isPlaywright(t, new Set(['Locator'])));
    };

    /** The first of these verbs a runtime driver's type offers, or null when the node is no driver or offers none. */
    const driverVerb = (node, verbs) => {
        const drivers = constituents(typeOf(node)).filter(isDriver);
        return verbs.find((verb) => drivers.length && drivers.every((type) => checker.getPropertyOfType(type, verb))) ?? null;
    };

    /** `driver` for a runtime driver, `raw` for Playwright's Locator, Page, Keyboard or Mouse, else null. */
    const receiverKind = (node) => {
        const parts = constituents(typeOf(node)).filter((type) => !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)));
        if (parts.some(isDriver)) {
            return 'driver';
        }
        return parts.some((type) => isPlaywright(type, PLAYWRIGHT_RECEIVERS)) ? 'raw' : null;
    };

    /**
     * The action a call performs, or null: `{verb, receiver, preparing, observed}`. `unsupported` is set
     * for a computed verb (`d['click']()`).
     */
    const actionOf = (call) => {
        if (call.type !== 'CallExpression') {
            return null;
        }
        const callee = unwrap(call.callee);
        const verb = propertyName(callee);
        if (!verb || !ACTIONS.has(verb)) {
            return null;
        }
        const object = unwrap(callee.object);
        if (isSettleCall(object)) {
            const driver = object.arguments[0];
            return {call, verb, receiver: driver, preparing: false, observed: true, unsupported: callee.computed ? 'computed' : null};
        }
        const kind = receiverKind(object);
        if (!kind) {
            return null;
        }
        return {
            call,
            verb,
            receiver: object,
            preparing: PREPARING.has(verb),
            observed: OBSERVING.has(verb),
            unsupported: callee.computed ? 'computed' : null,
        };
    };

    /**
     * `settle(...)`, under whatever name it is called (`settle as hold`, `runtime.settle`, `const hold = settle`). With
     * types, the call resolves to the runtime's declaration: a `settle` in another module whose result is that module's
     * own `Settling` type, so a local function or another module's helper named `settle` is not taken for it; without a
     * signature, the name decides.
     */
    const isSettleCall = (node) => {
        if (node?.type !== 'CallExpression') {
            return false;
        }
        const callee = unwrap(node.callee);
        const call = services.esTreeNodeToTSNodeMap.get(node);
        const declaration = checker.getResolvedSignature(call)?.declaration;
        if (!declaration || !ts.isFunctionLike(declaration)) {
            // no signature to read (untyped code): the name decides
            const name = callee.type === 'MemberExpression' && !callee.computed ? callee.property : callee;
            return name.type === 'Identifier' && name.name === 'settle';
        }

        // the declaration the call resolves to, whatever it is called here (`hold`, `runtime.settle`, `const hold =
        // settle`): the runtime's settle, in another module, returning that module's own Settling
        const home = declaration.getSourceFile();
        if (declaration.name?.getText() !== 'settle' || home === call.getSourceFile()) {
            return false;
        }
        const settling = typeOf(node).aliasSymbol;
        return settling?.getName() === 'Settling' && (settling.getDeclarations() ?? []).some((d) => d.getSourceFile() === home);
    };

    /**
     * A `settle(...)` whose result is not called on the spot as `settle(...).<verb>()`: stored, passed on, or with its
     * verb read off. The settled action then runs where no rule can see it.
     */
    const isDetachedSettle = (node) => {
        if (!isSettleCall(node)) {
            return false;
        }
        const {child, parent} = usedBy(node);
        if (parent?.type !== 'MemberExpression' || parent.object !== child || !ACTIONS.has(propertyName(parent))) {
            return true;
        }
        const member = usedBy(parent);
        return member.parent?.type !== 'CallExpression' || member.parent.callee !== member.child;
    };

    /** A verb read off a driver or Playwright object without calling it there (`const click = d.click`). */
    const isAliasedVerb = (member) => {
        const verb = propertyName(member);
        if (!verb || !ACTIONS.has(verb)) {
            return false;
        }
        const {child, parent} = usedBy(member);
        if (parent?.type === 'CallExpression' && parent.callee === child) {
            return false;
        }
        return receiverKind(unwrap(member.object)) !== null;
    };

    const isWaiter = (node) => {
        const call = unwrap(node);
        if (call?.type !== 'CallExpression') {
            return false;
        }
        const callee = unwrap(call.callee);
        return isIdentifier(callee, 'waitForApi') || propertyName(callee) === 'waitForEvent';
    };

    /**
     * For a `Promise.*` call holding an action: `{accepted, action}`. Accepted is exactly `Promise.all([<waiters>,
     * <one action>])`, waiters being `waitForApi(...)` or `x.waitForEvent(...)`. Null when the call holds no action.
     */
    const compositionOf = (call) => {
        if (call.type !== 'CallExpression' || !isPromiseCombinator(call.callee)) {
            return null;
        }
        const list = call.arguments[0] && unwrap(call.arguments[0]);
        const elements = list?.type === 'ArrayExpression' ? list.elements.map((element) => element && unwrap(element)) : [];
        const actions = elements.map((element) => (element?.type === 'CallExpression' ? actionOf(element) : null));
        if (!actions.some(Boolean)) {
            return null;
        }
        const last = actions[actions.length - 1];
        const accepted = propertyName(unwrap(call.callee)) === 'all' &&
            call.arguments.length === 1 &&
            elements.length >= 2 &&
            Boolean(last) &&
            !last.unsupported &&
            elements.slice(0, -1).every(isWaiter);
        return {accepted, action: accepted ? last : null, elements};
    };

    return {actionOf, compositionOf, driverVerb, isAliasedVerb, isDetachedSettle, receiverKind};
}

/** What a reader calls an action in a message: `modal.saveButton.click()`. */
export function label(sourceCode, action) {
    const text = sourceCode.getText(unwrap(action.call.callee)).replace(/\s+/g, ' ');
    return `${text.length > 60 ? `…${text.slice(-59)}` : text}()`;
}
