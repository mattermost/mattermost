// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import type ts from 'typescript';

import {exprName, strip, typeText} from './ast.ts';
import {cmp} from './compare.ts';
import {entityTypeModule} from './config.ts';
import {inputDiagnostic} from './input.ts';
import {MAX_BODY_TYPE_DEPTH, MAX_URL_DEPTH} from './limits.ts';
import type {Diagnostic} from './manifest_types.ts';
import type {ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';

export type ClientRoute = {verb: string; path: string};

/** A client method's response type as importable TypeScript. */
export type BodyType = {type: string; imports: Record<string, string>};

export type OpenApiOp = {verb: string; path: string; opId: string; file: string; schema: string | null; responses: string[]};

/** An operation an action can trigger: an OpenAPI operation, or a client endpoint missing from the spec. */
export type Operation = {
    opId: string;
    verb: string;
    path: string;

    /** TypeScript type of the response body (from the client method), or null when unknown. */
    body: string | null;
    bodyImports?: Record<string, string>;

    /** OpenAPI response schema name. */
    schema?: string | null;
    inSpec: boolean;
    client: string;
};

type Member = ts.ClassElement;

/** Client4 method -> HTTP verb + path template, by evaluating its route helpers. */
export function clientRoutes(ix: ProgramIndex): {routes: Map<string, ClientRoute[]>; bodies: Map<string, BodyType | null>; unresolved: Set<string>} {
    const routes = new Map<string, ClientRoute[]>();
    const bodies = new Map<string, BodyType | null>();
    const unresolved = new Set<string>();
    const cfg = ix.config.client;
    if (!cfg) {
        return {routes, bodies, unresolved};
    }
    const sf = ix.program.getSourceFile(cfg.file) ?? ix.program.getSourceFiles().find((f) => path.resolve(f.fileName) === path.resolve(cfg.file));
    if (!sf) {
        throw new Error(`client file ${cfg.file} is not part of the program`);
    }
    let cls: ts.ClassDeclaration | undefined;
    typescript.forEachChild(sf, (n) => {
        if (typescript.isClassDeclaration(n) && n.name?.text === cfg.className) {
            cls = n;
        }
    });
    if (!cls) {
        throw new Error(`class ${cfg.className} not found in ${cfg.file}`);
    }
    const members = new Map<string, Member>();
    for (const m of cls.members) {
        if (m.name) {
            members.set(m.name.getText(), m);
        }
    }
    const fnOf = (m: Member): ts.FunctionLikeDeclaration | null => {
        if (typescript.isMethodDeclaration(m)) {
            return m;
        }
        if (typescript.isPropertyDeclaration(m) && m.initializer && (typescript.isArrowFunction(m.initializer) || typescript.isFunctionExpression(m.initializer))) {
            return m.initializer;
        }
        return null;
    };
    const returnsOf = (fn: ts.FunctionLikeDeclaration) => {
        if (!fn.body) {
            return [];
        }
        if (!typescript.isBlock(fn.body)) {
            return [fn.body];
        }
        const o: ts.Expression[] = [];
        const v = (n: ts.Node) => {
            if (typescript.isReturnStatement(n) && n.expression) {
                o.push(n.expression);
            }
            if (!typescript.isFunctionLike(n)) {
                typescript.forEachChild(n, v);
            }
        };
        typescript.forEachChild(fn.body, v);
        return o;
    };

    const combine = (left: string[], right: string[]): string[] => {
        const result = left.flatMap((a) => right.map((b) => a + b));
        return result.length > 64 ? ['{*}'] : [...new Set(result)];
    };
    const evalUrl = (e: ts.Expression | undefined, env: Map<string, string[] | null>, depth = 0): string[] => {
        const x = strip(e) as ts.Expression;
        if (!x || depth > MAX_URL_DEPTH) {
            return ['{*}'];
        }
        if (typescript.isStringLiteralLike(x)) {
            return [x.text];
        }
        if (typescript.isTemplateExpression(x)) {
            return x.templateSpans.reduce((values, span) => combine(combine(values, evalUrl(span.expression, env, depth + 1)), [span.literal.text]), [x.head.text]);
        }
        if (typescript.isBinaryExpression(x) && x.operatorToken.kind === typescript.SyntaxKind.PlusToken) {
            return combine(evalUrl(x.left, env, depth + 1), evalUrl(x.right, env, depth + 1));
        }
        if (typescript.isConditionalExpression(x)) {
            return [...new Set([...evalUrl(x.whenTrue, env, depth + 1), ...evalUrl(x.whenFalse, env, depth + 1)])];
        }
        if (typescript.isPropertyAccessExpression(x) && x.expression.kind === typescript.SyntaxKind.ThisKeyword) {
            if (x.name.text === 'url') {
                return [''];
            }
            return x.name.text === 'urlVersion' ? [cfg.urlVersion] : ['{*}'];
        }
        if (typescript.isPropertyAccessExpression(x)) {
            return [`{${x.getText()}}`];
        }
        if (typescript.isCallExpression(x)) {
            const callee = strip(x.expression) as ts.Expression;
            if (typescript.isPropertyAccessExpression(callee) && callee.expression.kind === typescript.SyntaxKind.ThisKeyword && members.has(callee.name.text)) {
                const fn = fnOf(members.get(callee.name.text)!);
                if (fn) {
                    const bound = new Map<string, string[] | null>();
                    fn.parameters.forEach((parameter, index) => bound.set(parameter.name.getText(), x.arguments[index] ? evalUrl(x.arguments[index], env, depth + 1) : ['']));
                    return returnsOf(fn).flatMap((value) => evalUrl(value, bound, depth + 1));
                }
            }
            const name = exprName(callee);
            if (name === 'buildQueryString') {
                return [''];
            }
            if (['encodeURIComponent', 'encodeURI', 'toString', 'String'].includes(name)) {
                return evalUrl(x.arguments[0] ?? (typescript.isPropertyAccessExpression(callee) ? callee.expression : undefined), env, depth + 1);
            }
            return ['{*}'];
        }
        if (typescript.isIdentifier(x)) {
            if (env.has(x.text)) {
                return env.get(x.text) ?? [`{${x.text}}`];
            }
            const declaration = ix.checker.getSymbolAtLocation(x)?.valueDeclaration;
            if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
                return evalUrl(declaration.initializer, env, depth + 1);
            }
            return [`{${x.text}}`];
        }
        return ['{*}'];
    };
    const methodValues = (node: ts.Expression | undefined, depth = 0): string[] | null => {
        const expression = strip(node) as ts.Expression | undefined;
        if (!expression || depth > MAX_URL_DEPTH) {
            return null;
        }
        if (typescript.isStringLiteralLike(expression)) {
            return [expression.text.toUpperCase()];
        }
        if (typescript.isConditionalExpression(expression)) {
            const yes = methodValues(expression.whenTrue, depth + 1);
            const no = methodValues(expression.whenFalse, depth + 1);
            return yes && no ? [...new Set([...yes, ...no])] : null;
        }
        if (typescript.isIdentifier(expression)) {
            const symbol = typescript.isShorthandPropertyAssignment(expression.parent) ? ix.checker.getShorthandAssignmentValueSymbol(expression.parent) : ix.checker.getSymbolAtLocation(expression);
            const declaration = symbol?.valueDeclaration;
            if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
                return methodValues(declaration.initializer, depth + 1);
            }
        }
        const type = ix.checker.getTypeAtLocation(expression);
        const alternatives = type.isUnion() ? type.types : [type];
        return alternatives.every((item) => item.isStringLiteral()) ? alternatives.map((item) => (item as ts.StringLiteralType).value.toUpperCase()) : null;
    };
    for (const [name, m] of members) {
        const fn = fnOf(m);
        if (!fn || !fn.body) {
            continue;
        }
        const found: ClientRoute[] = [];
        const v = (n: ts.Node) => {
            if (typescript.isCallExpression(n)) {
                const c = strip(n.expression) as ts.Expression;
                if (typescript.isPropertyAccessExpression(c) && c.expression.kind === typescript.SyntaxKind.ThisKeyword && (/^doFetch/).test(c.name.text) && n.arguments[0]) {
                    const env = new Map<string, string[] | null>(fn.parameters.map((parameter) => [parameter.name.getText(), null]));
                    const urls = evalUrl(n.arguments[0], env).map((url) => url.split('?')[0].replace(/\/$/, ''));
                    let options = strip(n.arguments[1]) as ts.Expression | undefined;
                    if (options && typescript.isIdentifier(options)) {
                        const declaration = ix.checker.getSymbolAtLocation(options)?.valueDeclaration;
                        if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
                            options = strip(declaration.initializer) as ts.Expression;
                        }
                    }
                    let methods: string[] | null = ['GET'];
                    if (options && typescript.isObjectLiteralExpression(options)) {
                        const property = [...options.properties].reverse().find((item) => item.name?.getText() === 'method');
                        if (property && typescript.isPropertyAssignment(property)) {
                            methods = methodValues(property.initializer);
                        } else if (property && typescript.isShorthandPropertyAssignment(property)) {
                            methods = methodValues(property.name);
                        }
                        if (options.properties.some(typescript.isSpreadAssignment)) {
                            unresolved.add(name);
                        }
                    } else if (options) {
                        methods = null;
                    }
                    if (!methods || methods.some((method) => !['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) || urls.some((url) => url.includes('{*}'))) {
                        unresolved.add(name);
                    }
                    for (const method of methods ?? []) {
                        for (const url of urls.filter((value) => !value.includes('{*}'))) {
                            if (['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                                found.push({verb: method, path: url});
                            }
                        }
                    }
                }
            }
        };
        const terminal = (statement: ts.Statement) => typescript.isReturnStatement(statement) || typescript.isThrowStatement(statement) || typescript.isBreakStatement(statement) || typescript.isContinueStatement(statement);
        const visitReachable = (n: ts.Node): void => {
            if (n !== fn && (typescript.isFunctionLike(n) || typescript.isMethodDeclaration(n))) {
                if (n.getText().includes('doFetch')) {
                    unresolved.add(name);
                }
                return;
            }
            if (typescript.isBlock(n) || typescript.isSourceFile(n)) {
                let reachable = true;
                for (const statement of n.statements) {
                    if (!reachable) {
                        break;
                    }
                    visitReachable(statement);
                    if (terminal(statement)) {
                        reachable = false;
                    }
                }
                return;
            }
            v(n);
            typescript.forEachChild(n, visitReachable);
        };
        visitReachable(fn.body);
        if (found.length) {
            routes.set(name, found);
            bodies.set(name, bodyTypeOf(ix, fn));
        }
    }
    return {routes, bodies, unresolved};
}

/** `Promise<Channel>` -> Channel, importable from the configured module when declared in an entity directory. */
function bodyTypeOf(ix: ProgramIndex, fn: ts.FunctionLikeDeclaration): BodyType | null {
    const sig = ix.checker.getSignatureFromDeclaration(fn);
    if (!sig) {
        return null;
    }
    let t = ix.checker.getReturnTypeOfSignature(sig);
    if (t.getSymbol()?.getName() === 'Promise') {
        const [inner] = ix.checker.getTypeArguments(t as ts.TypeReference);
        if (inner) {
            t = inner;
        }
    }

    // doFetchWithResponse returns {response, headers, data}: the response body is `data`
    const data = (t.aliasSymbol ?? t.getSymbol())?.getName() === 'ClientResponse' ? ix.checker.getPropertyOfType(t, 'data') : undefined;
    if (data) {
        t = ix.checker.getTypeOfSymbolAtLocation(data, fn);
    }
    if (t.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown)) {
        return null;
    }
    const imports: Record<string, string> = {};
    const ok = collectImports(ix, t, imports, 0);
    if (!ok) {
        return null;
    }

    // union member order depends on type creation order in the checker: sort for a deterministic manifest
    const text = typeText(ix.checker, t, typescript.TypeFormatFlags.NoTruncation | typescript.TypeFormatFlags.UseFullyQualifiedType).replace(/import\("[^"]+"\)\./g, '');
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(imports).sort()) {
        sorted[k] = imports[k];
    }
    return {type: text, imports: sorted};
}

/** Every named type in `t` must be importable (from an entity dir) or built-in. */
function collectImports(ix: ProgramIndex, t: ts.Type, out: Record<string, string>, depth: number): boolean {
    if (depth > MAX_BODY_TYPE_DEPTH) {
        return false;
    }
    if (t.flags & (typescript.TypeFlags.String | typescript.TypeFlags.Number | typescript.TypeFlags.Boolean | typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Void | typescript.TypeFlags.Literal | typescript.TypeFlags.BooleanLiteral)) {
        return true;
    }
    const alias = t.aliasSymbol;

    // a named alias from the entity dirs (ServerChannel = Channel & {...}) is imported by name
    const aliasDecl = alias?.declarations?.[0];
    const aliasDir = aliasDecl && ix.config.entityTypeDirs.find((d) => path.resolve(aliasDecl.getSourceFile().fileName).startsWith(d + path.sep));
    if ((t.isUnion() || t.isIntersection()) && !aliasDir) {
        return t.types.every((m) => collectImports(ix, m, out, depth + 1));
    }
    const sym = alias ?? t.getSymbol();
    if (ix.checker.isArrayType(t) && !aliasDir) {
        const [el] = ix.checker.getTypeArguments(t as ts.TypeReference);
        return el ? collectImports(ix, el, out, depth + 1) : false;
    }
    if (sym) {
        const name = sym.getName();
        if (name === '__type' || name === '__object') {
            return false;
        }
        if (['Record', 'Partial', 'Array', 'Map', 'Set', 'Promise', 'Blob'].includes(name)) {
            const args = alias ? (t.aliasTypeArguments ?? []) : ix.checker.getTypeArguments(t as ts.TypeReference);
            return (args ?? []).every((a) => collectImports(ix, a, out, depth + 1));
        }
        const decl = sym.declarations?.[0];
        const file = decl ? path.resolve(decl.getSourceFile().fileName) : '';
        const dir = ix.config.entityTypeDirs.find((d) => file.startsWith(d + path.sep));
        if (!dir) {
            return false;
        }
        out[name] = entityTypeModule(ix.config, dir, file);
        let args: readonly ts.Type[] = [];
        if (alias) {
            args = t.aliasTypeArguments ?? [];
        } else if ((t as ts.TypeReference).target) {
            args = ix.checker.getTypeArguments(t as ts.TypeReference);
        }
        return (args ?? []).every((a) => collectImports(ix, a, out, depth + 1));
    }
    return false;
}

/** The OpenAPI operations in a directory of yaml files; a file that doesn't parse is an `input` error in `problems`. */
export function openApiOps(dir: string | null, problems: Diagnostic[] = []): OpenApiOp[] {
    if (!dir || !fs.existsSync(dir)) {
        return [];
    }
    const ops: OpenApiOp[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()) {
        let doc: unknown;
        try {
            doc = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8'));
        } catch (e) {
            problems.push(inputDiagnostic(path.join(dir, f), `OpenAPI file ${f} doesn't parse: ${(e as Error).message.split('\n')[0]}`, 'Fix the yaml: its operations are left out of the scan until it parses.'));
            continue;
        }
        if (!doc || typeof doc !== 'object') {
            continue;
        }
        for (const [p, item] of Object.entries(doc as Record<string, unknown>)) {
            if (!p.startsWith('/') || !item || typeof item !== 'object') {
                continue;
            }
            for (const [verb, op] of Object.entries(item as Record<string, {operationId?: string; responses?: Record<string, {content?: Record<string, {schema?: {$ref?: string; type?: string; items?: {$ref?: string}}}>}>}>)) {
                if (!['get', 'post', 'put', 'patch', 'delete'].includes(verb) || !op || !op.operationId) {
                    continue;
                }
                const okResp = op.responses && (op.responses['200'] ?? op.responses['201']);
                const sch = okResp?.content?.['application/json']?.schema;
                const ref = sch && (sch.$ref ?? sch.items?.$ref);
                const schema = ref ? ref.split('/').pop()! + (sch.items ? '[]' : '') : sch?.type ?? null;
                ops.push({verb: verb.toUpperCase(), path: p, opId: op.operationId, file: f, schema, responses: op.responses ? Object.keys(op.responses) : []});
            }
        }
    }
    return ops;
}

export const normPath = (p: string) => p.replace(/\{[^}]*\}/g, '{}').replace(/\/$/, '');

/**
 * Exact verb+path match first; then segment-wise, where a spec parameter may be filled by a
 * literal the client hard-codes (/users/me/patch against /users/{user_id}/patch).
 */
export function opMatcher(ops: OpenApiOp[]): (verb: string, p: string) => OpenApiOp | null {
    const idx = new Map<string, OpenApiOp>();
    for (const o of ops) {
        const k = o.verb + ' ' + normPath(o.path);
        if (!idx.has(k)) {
            idx.set(k, o);
        }
    }
    const segs = ops.map((o) => ({o, s: normPath(o.path).split('/')}));
    return (verb, p) => {
        const exact = idx.get(verb + ' ' + normPath(p));
        if (exact) {
            return exact;
        }
        const cs = normPath(p).split('/');
        const cands = segs.filter(({o, s}) => o.verb === verb && s.length === cs.length && s.every((x, i) => x === cs[i] || x === '{}'));
        cands.sort((a, b) => b.s.filter((x) => x !== '{}').length - a.s.filter((x) => x !== '{}').length || cmp(a.o.opId, b.o.opId));
        return cands.length ? cands[0].o : null;
    };
}

/**
 * The spec path with `me` where the client hard-codes it for a placeholder (`/api/v4/users/{user_id}/status/custom`
 * called as `/users/me/status/custom` -> `/api/v4/users/me/status/custom`), or null when it fills none with `me`.
 */
export function meForm(specPath: string, clientPath: string): string | null {
    const spec = specPath.replace(/\/$/, '').split('/');
    const client = normPath(clientPath).split('/');
    if (spec.length !== client.length) {
        return null;
    }
    let found = false;
    const out = spec.map((s, i) => {
        if ((/^\{[^}]*\}$/).test(s) && client[i] === 'me') {
            found = true;
            return 'me';
        }
        return s;
    });
    return found ? out.join('/') : null;
}

/** `getMe` -> `GetMe`: an operation id for a client method the spec doesn't have. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Client method name -> operations it can call (one per route found in it). */
export class Operations {
    readonly unresolvedClientMethods: Set<string>;
    readonly byClientMethod = new Map<string, Operation[]>();
    readonly byId = new Map<string, Operation>();
    readonly specOps: OpenApiOp[];
    readonly stats: Record<string, number>;

    /** Inputs it couldn't read (an OpenAPI file that doesn't parse). */
    readonly diagnostics: Diagnostic[] = [];

    constructor(ix: ProgramIndex) {
        const {routes, bodies, unresolved} = clientRoutes(ix);
        this.unresolvedClientMethods = unresolved;
        this.specOps = openApiOps(ix.config.openapiDir, this.diagnostics);
        this.diagnostics.forEach((d) => {
            d.at = ix.rel(d.at);
        });
        const match = opMatcher(this.specOps);
        let fetches = 0;
        let apiCalls = 0;
        let matched = 0;
        for (const name of [...routes.keys()].sort()) {
            const ops: Operation[] = [];
            for (const r of routes.get(name)!) {
                fetches++;
                if (!r.path.startsWith(ix.config.client!.urlVersion)) {
                    continue;
                }
                apiCalls++;
                const m = match(r.verb, r.path);
                if (m) {
                    matched++;
                }
                const body = bodies.get(name) ?? null;

                // the client calls the current user's form (`/users/me/…`): its own operation, `<OpId>Me`, with the literal
                // path, so waiting for the template (`/users/{user_id}/…`) can mean another user
                const me = m ? meForm(m.path, r.path) : null;
                const fallback = routes.get(name)!.length === 1 ? capitalize(name) : capitalize(name) + r.verb + r.path.replace(/[^a-zA-Z0-9]+/g, '_');
                const opId = m ? `${m.opId}${me ? 'Me' : ''}` : fallback;
                const existing = this.byId.get(opId);
                if (existing && (existing.verb !== (m ? m.verb : r.verb) || canonicalPattern(existing.path) !== canonicalPattern(m ? me ?? m.path : r.path))) {
                    this.diagnostics.push({rule: 'collisions', severity: 'error', at: ix.rel(ix.config.client!.file), message: `Operation ${opId} names more than one method/path pattern.`});
                }
                const op: Operation = existing ?? {
                    opId,
                    verb: m ? m.verb : r.verb,
                    path: m ? me ?? m.path : r.path,
                    body: body?.type ?? null,
                    ...(body && Object.keys(body.imports).length ? {bodyImports: body.imports} : {}),
                    schema: m?.schema ?? null,
                    inSpec: Boolean(m),
                    client: name,
                };
                this.byId.set(opId, op);
                ops.push(op);
            }
            if (ops.length) {
                this.byClientMethod.set(name, ops);
            }
        }
        this.stats = {clientMethods: routes.size, fetchCalls: fetches, apiCalls, matchedToOpenAPI: matched, openApiOps: this.specOps.length};
        const patterns = new Map<string, string>();
        for (const operation of this.byId.values()) {
            const pattern = operation.verb.toUpperCase() + ' ' + canonicalPattern(operation.path);
            const previous = patterns.get(pattern);
            if (previous && previous !== operation.opId) {
                this.diagnostics.push({rule: 'collisions', severity: 'error', at: ix.rel(ix.config.client!.file), message: `Operations ${previous} and ${operation.opId} share the method/path pattern ${pattern}; placeholder names do not distinguish operations.`});
            }
            patterns.set(pattern, operation.opId);
        }
    }
}

/** Placeholder spelling cannot distinguish two operations of one catalog. */
function canonicalPattern(value: string): string {
    return value.replace(/\{[^/{}]+\}/g, '{}');
}
