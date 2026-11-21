#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `static_spec`: token/AST-level rules over emitted Playwright specs (TypeScript compiler API).
// Interface: gate.run({files, config?, testTimeoutMs?, expectTimeoutMs?, maxConsecutiveSoft?}) -> {status, evidence}.
// ctx.probeIds (optional): the only probe ids an `absence-verified:` marker may name.
// CLI: static_spec_check.mjs [--config f] [--test-timeout-ms n] [--expect-timeout-ms n] [--max-consecutive-soft n]
//      [--probe-id id]... [--text] <spec>...
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    EXIT,
    REPO_ROOT,
    compareStrings,
    UsageError,
    exitCodeFor,
    guarded,
    parseArgs,
    positiveInt,
    printJson,
    runCli,
} from './common.mjs';
import {
    ACTIONS,
    ASYNC_MATCHERS,
    DEFAULT_CONFIG,
    DURATIONS,
    FALLBACK_TIMEOUTS,
    LEAK_PATTERNS,
    NAVIGATION,
    POST_CALLS,
    RANDOM_SEGMENT,
    RULES,
    SECRET_KEY,
    SECRET_TEXT,
    SELECTOR_CALLS,
    SERVER_ID,
    SIDEBAR_LINK_NAME,
    SLEEP_CALLS,
    TEXT_FACTORIES,
    TS_DIR,
} from './static_spec_rules.mjs';
import {
    asAssertion,
    calleePath,
    classify,
    collectComments,
    collectFactories,
    describeFactory,
    enclosingStatement,
    isAwaited,
    optionProperty,
    redact,
    snippetOf,
    stringValue,
    timeoutOf,
} from './static_spec_ast.mjs';

export {RULES};

let tsModule;
export function loadTypeScript() {
    if (tsModule === undefined) {
        try {
            tsModule = createRequire(import.meta.url)(TS_DIR);
        } catch {
            tsModule = null;
        }
    }
    return tsModule;
}

export function resolveTimeouts(options = {}) {
    const result = {...FALLBACK_TIMEOUTS, source: 'builtin-default'};
    const ts = loadTypeScript();
    const explicitConfig = options.config;
    const configPath = explicitConfig ?? DEFAULT_CONFIG;
    if (ts && fs.existsSync(configPath)) {
        const parsed = readConfigTimeouts(ts, configPath);
        if (parsed) {
            Object.assign(result, parsed, {source: path.relative(REPO_ROOT, configPath).split(path.sep).join('/')});
        } else if (explicitConfig) {
            throw new UsageError('config file has no readable timeout values');
        }
    } else if (explicitConfig) {
        throw new UsageError('config file is not readable');
    }
    if (options.testTimeoutMs !== undefined) {
        result.testTimeoutMs = options.testTimeoutMs;
        result.source = 'option';
    }
    if (options.expectTimeoutMs !== undefined) {
        result.expectTimeoutMs = options.expectTimeoutMs;
        result.source = 'option';
    }
    return result;
}

function readConfigTimeouts(ts, file) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const value = (node) => {
        if (!node) {
            return undefined;
        }
        if (ts.isNumericLiteral(node)) {
            return Number(node.text);
        }
        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'duration'
        ) {
            return DURATIONS[node.name.text];
        }
        return undefined;
    };
    let testTimeoutMs;
    let expectTimeoutMs;
    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineConfig') {
            const config = node.arguments[0];
            testTimeoutMs = value(optionProperty(ts, config, 'timeout')?.initializer);
            expectTimeoutMs = value(
                optionProperty(ts, optionProperty(ts, config, 'expect')?.initializer, 'timeout')?.initializer,
            );
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return testTimeoutMs !== undefined && expectTimeoutMs !== undefined ? {testTimeoutMs, expectTimeoutMs} : undefined;
}

export function checkSource({file, text}, options = {}) {
    const ts = loadTypeScript();
    if (!ts) {
        throw new UsageError('TypeScript is not available under e2e-tests/playwright/node_modules');
    }
    const timeouts = options.timeouts ?? resolveTimeouts(options);
    const maxConsecutiveSoft = options.maxConsecutiveSoft ?? 3;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const evidence = [];
    const seen = new Set();
    const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const add = (rule, node, detail, {secret = false} = {}) => {
        const raw = node.getText(sf);
        const snippet = snippetOf(secret ? redact(raw) : raw);
        const line = lineOf(node);
        const key = `${rule}:${line}:${snippet}:${detail ?? ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            evidence.push({rule, file, line, snippet, ...(detail ? {detail} : {})});
        }
    };

    const syntax = sf.parseDiagnostics ?? [];
    if (syntax.length > 0) {
        const line = sf.getLineAndCharacterOfPosition(syntax[0].start ?? 0).line + 1;
        return [{rule: 'parse-error', file, line, snippet: '(syntax error)'}];
    }

    const comments = collectComments(ts, sf);
    const endLineOf = (node) => sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    const trailingComments = (node) => {
        const statement = enclosingStatement(ts, node);
        const line = endLineOf(statement);
        return comments
            .filter((c) => c.line === line && c.pos >= statement.getEnd())
            .map((c) => c.text.replace(/^\/\/\s*/, ''));
    };
    const hasMarker = (node, regex) => trailingComments(node).some((t) => regex.test(t));
    const probeMarker = (node) => {
        for (const text of trailingComments(node)) {
            const match = /\babsence-verified: ([A-Za-z0-9_.:-]+)/.exec(text);
            if (match) {
                return match[1];
            }
        }
        return undefined;
    };

    const assertions = [];
    const actions = [];
    const tests = [];
    const fileTimeouts = [];
    let createsPosts = false;

    const visit = (node) => {
        if (ts.isCallExpression(node)) {
            inspectCall(node);
        }
        if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
            inspectProperty(node);
        }
        if (
            ts.isStringLiteralLike(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
        ) {
            inspectLiteral(node);
        }
        if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
            inspectBinding(node);
        }
        ts.forEachChild(node, visit);
    };

    function inspectCall(call) {
        const callPath = calleePath(ts, call.expression);
        const last = callPath[callPath.length - 1];
        const callee = call.expression;

        if (SLEEP_CALLS.has(last) || (last === 'wait' && isNumericLike(call.arguments[0]))) {
            add('sleep-wait', call);
        }
        if (ts.isPropertyAccessExpression(callee) && SELECTOR_CALLS.has(last)) {
            add('css-xpath-locator', call);
        }
        if (callPath[0] === 'test' || callPath[0] === 'it') {
            inspectTestCall(call, callPath);
        }
        if (/^skipIf/.test(last ?? '')) {
            add('skip-fixme', call);
        }
        if (POST_CALLS.test(last ?? '') || (callPath.includes('random') && last === 'post')) {
            createsPosts = true;
        }
        const randomSegment = callPath.find((s) => RANDOM_SEGMENT.test(s));
        const isMathRandom = callPath[0] === 'Math' && last === 'random';
        const isDateNow = callPath[0] === 'Date' && last === 'now';
        if ((randomSegment || isMathRandom || isDateNow) && !hasMarker(call, /\brandom-ok: \S/)) {
            add('random-data', call);
        }

        const assertion = asAssertion(ts, call);
        if (assertion) {
            assertions.push(assertion);
            inspectAssertion(assertion);
            return;
        }
        if (ts.isPropertyAccessExpression(callee) && ACTIONS.has(last)) {
            actions.push(call);
            inspectAction(call);
        } else if (ts.isPropertyAccessExpression(callee) && NAVIGATION.has(last)) {
            actions.push(call);
        }
        if (callPath.join('.') === 'test.setTimeout' && ts.isNumericLiteral(call.arguments[0])) {
            fileTimeouts.push({pos: call.getStart(sf), ms: Number(call.arguments[0].text)});
        }
    }

    function isNumericLike(node) {
        return (
            Boolean(node) &&
            (ts.isNumericLiteral(node) ||
                (ts.isPropertyAccessExpression(node) && calleePath(ts, node)[0] === 'duration'))
        );
    }

    function inspectTestCall(call, callPath) {
        const tail = callPath.slice(1).join('.');
        if (/(^|\.)(skip|fixme)$/.test(tail)) {
            add('skip-fixme', call);
        }
        if (/(^|\.)only$/.test(tail)) {
            add('test-only', call);
        }
        if (tail === 'describe.configure') {
            const config = call.arguments[0];
            if (optionProperty(ts, config, 'retries')) {
                add('retries-config', call);
            }
            if (stringValue(ts, optionProperty(ts, config, 'mode')?.initializer) === 'parallel') {
                add('describe-parallel', call);
            }
        }
        const body = call.arguments[call.arguments.length - 1];
        if (
            (tail === '' || tail === 'only') &&
            call.arguments.length >= 2 &&
            body &&
            (ts.isArrowFunction(body) || ts.isFunctionExpression(body))
        ) {
            tests.push({call, body});
        }
    }

    function inspectProperty(property) {
        const name = property.name?.text;
        if (name === 'retries') {
            add('retries-config', property);
        }
        if (ts.isPropertyAssignment(property) && typeof name === 'string' && SECRET_KEY.test(name)) {
            const value = stringValue(ts, property.initializer);
            if (value !== undefined && value.length > 0) {
                add('password-literal', property, undefined, {secret: true});
            }
        }
    }

    function inspectBinding(declaration) {
        if (ts.isIdentifier(declaration.name) && SECRET_KEY.test(declaration.name.text) && declaration.initializer) {
            const value = stringValue(ts, declaration.initializer);
            if (value !== undefined && value.length > 0) {
                add('password-literal', declaration, undefined, {secret: true});
            }
        }
    }

    function inspectLiteral(node) {
        const value = node.text;
        if (LEAK_PATTERNS.some((p) => p.test(value))) {
            add('raw-url', node, undefined, {secret: true});
        }
        if (SERVER_ID.test(value)) {
            add('server-id', node, undefined, {secret: true});
        }
        if (SECRET_TEXT.test(value)) {
            add('password-literal', node, undefined, {secret: true});
        }
    }

    function inspectAssertion(assertion) {
        const statement = enclosingStatement(ts, assertion.call);
        const kind = classify(ts, assertion);
        const factories = assertion.subject ? collectFactories(ts, assertion.subject) : [];

        if (assertion.soft && !hasMarker(assertion.call, /\bsoft-ok: \S/)) {
            add('soft-declared', statement);
        }
        if (!trailingComments(assertion.call).some((t) => /^(declared \([^)]+\)|smoke: \S)/.test(t))) {
            add('label-missing', statement);
        }
        if (!isAwaited(ts, assertion.call) && (assertion.poll || ASYNC_MATCHERS.has(assertion.matcher))) {
            add('unawaited-assertion', statement);
        }

        if (kind === 'presence') {
            for (const factory of factories.filter((f) => TEXT_FACTORIES.has(f.name))) {
                const described = describeFactory(ts, factory);
                if (described.nameKind === 'regex') {
                    add('regex-presence', statement);
                } else if (described.nameKind !== 'none' && !described.exact) {
                    add(factory.name === 'getByText' ? 'get-by-text-presence' : 'presence-name-not-exact', statement);
                }
            }
        }
        if (kind === 'absence') {
            const target = factories[0];
            if (target && TEXT_FACTORIES.has(target.name)) {
                const described = describeFactory(ts, target);
                if (described.nameKind !== 'none' && described.exact) {
                    const probe = probeMarker(assertion.call);
                    if (!probe) {
                        add('absence-exact-name', statement);
                    } else if (options.probeIds && !options.probeIds.includes(probe)) {
                        add('absence-exact-name', statement, 'unknown probe id');
                    }
                }
            }
        }
        inspectSidebarLinks(statement, factories, assertion.call);
    }

    function inspectAction(call) {
        const factories = collectFactories(ts, call.expression.expression);
        const closest = factories[0];
        if (!closest) {
            return;
        }
        if (closest.name !== 'getByRole') {
            add('action-not-role', enclosingStatement(ts, call));
            return;
        }
        const described = describeFactory(ts, closest);
        if (described.nameKind !== 'none' && !described.exact) {
            add('action-name-not-exact', enclosingStatement(ts, call));
        }
        inspectSidebarLinks(enclosingStatement(ts, call), factories, call);
    }

    const unreadFindings = [];
    function inspectSidebarLinks(statement, factories, anchor) {
        for (const factory of factories) {
            if (factory.name !== 'getByRole' || stringValue(ts, factory.call.arguments[0]) !== 'link') {
                continue;
            }
            const described = describeFactory(ts, factory);
            const sidebarLink = SIDEBAR_LINK_NAME.test(described.nameText);
            if (
                described.nameKind === 'string' &&
                described.exact &&
                sidebarLink &&
                !/ unread$/.test(described.nameText)
            ) {
                unreadFindings.push({statement, anchor});
            }
        }
    }

    visit(sf);

    for (const comment of comments) {
        const body = comment.text.replace(/^\/\/|^\/\*+|\*+\/$/g, '');
        const rules = [
            ['raw-url', LEAK_PATTERNS.some((p) => p.test(body))],
            ['server-id', SERVER_ID.test(body)],
            ['password-literal', SECRET_TEXT.test(body)],
        ];
        for (const [rule, hit] of rules) {
            const snippet = snippetOf(redact(comment.text));
            const key = `${rule}:${comment.line}:${snippet}:`;
            if (hit && !seen.has(key)) {
                seen.add(key);
                evidence.push({rule, file, line: comment.line, snippet});
            }
        }
    }

    if (createsPosts) {
        for (const finding of unreadFindings) {
            if (!hasMarker(finding.anchor, /\bunread-ok: \S/)) {
                add('unread-suffix', finding.statement);
            }
        }
    }

    if (tests.length === 0) {
        evidence.push({rule: 'no-tests', file, line: 1, snippet: '(no test() call found)'});
    }
    for (const test of tests) {
        inspectTest(test);
    }

    function inspectTest({call, body}) {
        const statement = enclosingStatement(ts, call);
        const leading = ts.getLeadingCommentRanges(sf.text, statement.getFullStart()) ?? [];
        if (!leading.some((r) => /@objective\s+\S/.test(sf.text.slice(r.pos, r.end)))) {
            add('missing-objective', statement);
        }
        const within = (n) => n.getStart(sf) >= body.getStart(sf) && n.getEnd() <= body.getEnd();
        const mine = assertions.filter((a) => within(a.call)).sort((a, b) => a.call.getStart(sf) - b.call.getStart(sf));
        const myActions = actions.filter(within);

        const lastAction = myActions.reduce((max, a) => Math.max(max, a.getEnd()), -1);
        if (!mine.some((a) => a.call.getStart(sf) > lastAction)) {
            add('no-trailing-assertion', statement);
        }

        let run = [];
        const flushRun = () => {
            if (run.length > maxConsecutiveSoft) {
                add(
                    'soft-consecutive',
                    enclosingStatement(ts, run[maxConsecutiveSoft].call),
                    `${run.length} consecutive soft assertions, cap ${maxConsecutiveSoft}`,
                );
            }
            run = [];
        };
        for (const a of mine) {
            if (a.soft) {
                run.push(a);
            } else {
                flushRun();
            }
        }
        flushRun();

        const testTimeoutMs = effectiveTestTimeout(body, timeouts.testTimeoutMs);
        let softTotal = 0;
        let hardMax = 0;
        let firstSoft;
        for (const a of mine) {
            const configured = timeoutOf(ts, a.args);
            const t = configured === 0 ? Infinity : (configured ?? timeouts.expectTimeoutMs);
            if (a.soft) {
                softTotal += t;
                firstSoft ??= a;
            } else {
                hardMax = Math.max(hardMax, t);
            }
        }
        const worst = softTotal + hardMax;
        if (worst > testTimeoutMs) {
            const anchor = firstSoft ? enclosingStatement(ts, firstSoft.call) : statement;
            add('timeout-risk', anchor, `worst case ${worst}ms exceeds test timeout ${testTimeoutMs}ms`);
        }
    }

    function effectiveTestTimeout(body, fallback) {
        const inBody = fileTimeouts.filter((t) => t.pos >= body.getStart(sf) && t.pos <= body.getEnd());
        const outside = fileTimeouts.filter((t) => t.pos < body.getStart(sf));
        const chosen = inBody.at(-1) ?? outside.at(-1);
        return chosen ? chosen.ms : fallback;
    }

    return evidence.sort((a, b) => a.line - b.line || compareStrings(a.rule, b.rule));
}

export function checkFiles(files, options = {}) {
    const timeouts = resolveTimeouts(options);
    const evidence = [];
    for (const file of files) {
        let text;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            throw new UsageError(`cannot read ${path.basename(file)}`);
        }
        evidence.push(...checkSource({file, text}, {...options, timeouts}));
    }
    return {status: evidence.length === 0 ? 'pass' : 'fail', evidence, files: files.length, timeouts};
}

export const gate = {
    id: 'static_spec',
    run(ctx = {}) {
        return guarded(() => {
            if (!loadTypeScript()) {
                return {status: 'blocked', evidence: [{rule: 'input', detail: 'TypeScript compiler API unavailable'}]};
            }
            if (!Array.isArray(ctx.files) || ctx.files.length === 0) {
                return {status: 'blocked', evidence: [{rule: 'input', detail: 'ctx.files is empty'}]};
            }
            const {status, evidence} = checkFiles(ctx.files, ctx);
            return {status, evidence};
        });
    },
};

async function main() {
    const {positional, values} = parseArgs(process.argv.slice(2), {
        flags: ['text'],
        options: ['config', 'test-timeout-ms', 'expect-timeout-ms', 'max-consecutive-soft'],
        multi: ['probe-id'],
    });
    if (positional.length === 0) {
        throw new UsageError(
            'usage: static_spec_check.mjs [--config f] [--test-timeout-ms n] [--expect-timeout-ms n] [--max-consecutive-soft n] [--probe-id id]... [--text] <spec>...',
        );
    }
    const options = {config: values.config, ...(values['probe-id'] ? {probeIds: values['probe-id']} : {})};
    if (values['test-timeout-ms']) {
        options.testTimeoutMs = positiveInt(values['test-timeout-ms'], '--test-timeout-ms');
    }
    if (values['expect-timeout-ms']) {
        options.expectTimeoutMs = positiveInt(values['expect-timeout-ms'], '--expect-timeout-ms');
    }
    if (values['max-consecutive-soft']) {
        options.maxConsecutiveSoft = positiveInt(values['max-consecutive-soft'], '--max-consecutive-soft');
    }
    if (!loadTypeScript()) {
        printJson({status: 'blocked', evidence: [{rule: 'input', detail: 'TypeScript compiler API unavailable'}]});
        return EXIT.BLOCKED;
    }
    const result = checkFiles(positional, options);
    if (values.text) {
        for (const e of result.evidence) {
            process.stdout.write(`${e.file}:${e.line} ${e.rule}: ${e.snippet}${e.detail ? ` (${e.detail})` : ''}\n`);
        }
        process.stdout.write(`static_spec: ${result.status} (${result.evidence.length} finding(s))\n`);
    } else {
        printJson({status: result.status, evidence: result.evidence, files: result.files, timeouts: result.timeouts});
    }
    return exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
