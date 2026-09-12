import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {invariant, main, run} from './triage-lib.mjs';
const require = createRequire(import.meta.url);
const ts = require(process.env.TRIAGE_TYPESCRIPT_PATH || resolve('e2e-tests/playwright/node_modules/typescript/lib/typescript.js'));
const normalize = (node, file) => ts.createPrinter({removeComments: true}).printNode(ts.EmitHint.Unspecified, node, file);
const bag = (values) => { const m = new Map(); for (const s of values) m.set(s, (m.get(s) || 0) + 1); return m; };
const missing = (a, b) => [...bag(a)].filter(([s, n]) => (bag(b).get(s) || 0) < n).map(([s]) => s);
function inspect(source, name) {
    const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, /\.tsx?$/.test(name) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const result = {assertions: [], assertionScopes: [], scopedAssertions: [], actions: [], controlFlow: [], executionOrder: [], literalBindings: [], overrides: [], tests: [], bans: [], settings: [], semantic: []};
    invariant(!file.parseDiagnostics.length, `Cannot parse ${name}`);
    const aliases = new Map();
    function chain(n) {
        if (ts.isIdentifier(n)) return aliases.get(n.text) || n.text;
        if (ts.isPropertyAccessExpression(n)) return `${chain(n.expression)}.${n.name.text}`;
        if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return `${chain(n.expression)}.${n.argumentExpression.text}`;
        if (ts.isCallExpression(n)) return `${chain(n.expression)}()`;
        if (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n)) return chain(n.expression);
        return '';
    }
    function collect(n) {
        if (ts.isImportSpecifier(n)) aliases.set(n.name.text, n.propertyName?.text || n.name.text);
        if (ts.isVariableDeclaration(n) && n.initializer) {
            if (ts.isIdentifier(n.name)) aliases.set(n.name.text, chain(n.initializer));
            if (ts.isObjectBindingPattern(n.name)) for (const e of n.name.elements) if (ts.isIdentifier(e.name)) aliases.set(e.name.text, `${chain(n.initializer)}.${e.propertyName?.getText(file) || e.name.text}`);
        }
        ts.forEachChild(n, collect);
    }
    collect(file);
    function visit(n, scope = '<module>') {
        let childScope = scope;
        const text = normalize(n, file);
        if (ts.isCallExpression(n)) {
            const c = chain(n.expression);
            if (/(^|\.)(route|fulfill|intercept|stub|spyOn|mock|doMock|mockImplementation|mockReturnValue|mockResolvedValue|addInitScript|evaluate|evaluateHandle|writeFile|writeFileSync|appendFile|appendFileSync)$/.test(c) || /(^|\.)(expect|assert)\.extend$/.test(c) || /(^|\.)on$/.test(c) && ['fail', 'uncaught:exception'].includes(n.arguments[0]?.text)) result.overrides.push(`${scope}:${text}`);
            if (/(^|\.)(skip|only|fixme|todo|pending)$/.test(c) || /(^|\.)(xit|xdescribe|fit|fdescribe)$/.test(c)) result.bans.push(text);
            if (/(^|\.)(sleep|waitForTimeout)$/.test(c) || /^(?:(?:globalThis|window|global)\.)?(setTimeout|setInterval)$/.test(c) || /(^|\.)wait$/.test(c) && n.arguments[0] && !ts.isStringLiteralLike(n.arguments[0])) result.bans.push(text);
            if (/(^|\.)(setTimeout|timeout|slow|retries|retry)$/.test(c)) result.settings.push(text);
            // Preserve complete assertion expressions, including expected values. Counting alone misses weakening.
            const assertion = /(^|\.)(expect|assert)(\(|\.|$)/.test(c) || /\.(should|and)$/.test(c);
            if (assertion && !(ts.isPropertyAccessExpression(n.parent) || ts.isElementAccessExpression(n.parent))) {
                const key = `${scope}:${ts.isAwaitExpression(n.parent) ? 'await ' : ''}${text}`;
                result.assertions.push(text); result.assertionScopes.push(scope); result.scopedAssertions.push(key); result.executionOrder.push(`assertion:${key}`);
            }
            const declaration = /(^|\.)(it|test|describe|context)(\.(serial|parallel))?$/.test(c);
            if (declaration && n.arguments.length) {
                const title = n.arguments[0];
                if (ts.isStringLiteralLike(title)) { result.tests.push(`${scope}/${c}:${title.text}`); childScope = `${scope}/${c}:${title.text}`; }
                else result.semantic.push('Dynamic test title requires human review');
            }
            // Preserve existing actions independently of callback bodies so adding
            // an event wait inside an unchanged callback remains possible.
            if (!assertion && !declaration && !/(^|\.)(sleep|wait|waitForTimeout|setTimeout|setInterval)$/.test(c)) {
                const args = n.arguments.map(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg) ? '<callback>' : normalize(arg, file));
                const key = `${scope}:${ts.isAwaitExpression(n.parent) ? 'await ' : ''}${c}(${args.join(',')})`;
                result.actions.push(key); result.executionOrder.push(`action:${key}`);
            }
            if (c === 'eval' || c.endsWith('.eval') || c === 'Function') result.bans.push(text);
        }
        const value = ts.isVariableDeclaration(n) || ts.isPropertyAssignment(n) ? n.initializer : ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken ? n.right : undefined;
        if (value && (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(value.kind))) {
            const binding = ts.isBinaryExpression(n) ? n.left : n.name;
            result.literalBindings.push(`${scope}:${normalize(binding, file)}=${normalize(value, file)}`);
        }
        // Compare control decisions, not their whole bodies: an unchanged if
        // containing a legitimate added wait is different from a new bypass.
        let control;
        if (ts.isIfStatement(n) || ts.isConditionalExpression(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isSwitchStatement(n)) control = `${ts.SyntaxKind[n.kind]}:${normalize(n.expression || n.condition, file)}`;
        else if (ts.isReturnStatement(n) || ts.isBreakStatement(n) || ts.isContinueStatement(n) || ts.isThrowStatement(n)) control = text;
        else if (ts.isTryStatement(n)) control = `try:catch=${Boolean(n.catchClause)}:finally=${Boolean(n.finallyBlock)}`;
        else if (ts.isForStatement(n)) control = `for:${[n.initializer, n.condition, n.incrementor].map(v => v ? normalize(v, file) : '').join(';')}`;
        else if (ts.isForInStatement(n) || ts.isForOfStatement(n)) control = `${ts.SyntaxKind[n.kind]}:${normalize(n.initializer, file)}:${normalize(n.expression, file)}`;
        else if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) control = text;
        if (control) { result.controlFlow.push(`${scope}:${control}`); result.executionOrder.push(`control:${scope}:${control}`); }
        if ((ts.isPropertyAssignment(n) || ts.isBinaryExpression(n)) && /(?:timeout|retries|retry)/i.test(ts.isPropertyAssignment(n) ? n.name.getText(file) : n.left.getText(file))) result.settings.push(text);
        if (ts.isIfStatement(n) || ts.isReturnStatement(n) || ts.isConditionalExpression(n) || ts.isElementAccessExpression(n) && !ts.isStringLiteralLike(n.argumentExpression)) result.semantic.push('Control flow or dynamic property access requires human review');
        ts.forEachChild(n, child => visit(child, childScope));
        if (control) result.executionOrder.push(`end-control:${scope}:${control}`);
    }
    visit(file); return result;
}
export function checkSource(before, after, name, {strict = false} = {}) {
    const a = inspect(before, name); const b = inspect(after, name);
    const errors = [];
    if (missing(b.bans, a.bans).length) errors.push('New skip/only/fixme, bare wait/sleep, timer or dynamic execution');
    if (strict ? missing(a.assertions, b.assertions).length : missing(a.assertionScopes, b.assertionScopes).length) errors.push('Removed assertion from a test/suite; Guardian also requires unchanged expected values');
    if (missing(a.tests, b.tests).length) errors.push('Removed or renamed test/suite');
    if (strict && missing(b.settings, a.settings).length) errors.push('Guardian prohibits changed timeout/retry settings');
    if (strict && missing(b.controlFlow, a.controlFlow).length) errors.push('Guardian prohibits new or changed control flow that could bypass behavior');
    if (strict && missing(a.actions, b.actions).length) errors.push('Guardian prohibits removing or changing existing test actions');
    if (strict && missing(a.scopedAssertions, b.scopedAssertions).length) errors.push('Guardian prohibits moving assertions out of their original test/suite');
    if (strict && missing(a.literalBindings, b.literalBindings).length) errors.push('Guardian prohibits changing existing literal flags, inputs or expectations');
    if (strict && missing(b.overrides, a.overrides).length) errors.push('Guardian prohibits new behavior overrides, mocks, error suppression or report writes');
    if (strict) {
        let preserved = 0;
        for (const step of b.executionOrder) if (step === a.executionOrder[preserved]) preserved++;
        if (preserved !== a.executionOrder.length) errors.push('Guardian prohibits reordering existing behavior or control flow');
    }
    if (!strict) for (const setting of missing(b.settings, a.settings)) {
        const numberSetting = text => /^(\w+(?:\.\w+)*)\s*[:=]\s*(\d+)\s*;?$/.exec(text) || /^(\w+(?:\.\w+)*)\((\d+)\);?$/.exec(text);
        const literal = numberSetting(setting);
        if (!literal) continue;
        const old = a.settings.map(numberSetting).filter(m => m && m[1] === literal[1]);
        if (old.length && Number(literal[2]) > Math.max(...old.map(m => Number(m[2])))) errors.push('Raised literal timeout/retry setting');
    }
    if (missing(after.match(/@(skip|ignore)\b/g) || [], before.match(/@(skip|ignore)\b/g) || []).length) errors.push('New skip/ignore selection tag');
    return {errors, annotations: before === after ? [] : ['Semantic validity is unknown: human review must check assertion strength, control flow, coverage and causal diagnosis.', ...new Set(b.semantic)]};
}
export async function checkDiff(cwd, base, head) {
    invariant(/^[a-f0-9]{40}$/.test(base) && (!head || /^[a-f0-9]{40}$/.test(head)), 'Policy requires exact commit SHA');
    const args = ['diff', '--name-only', '-z', base, ...(head ? [head] : []), '--', 'e2e-tests'];
    const files = (await run('git', args, {cwd})).stdout.split('\0').filter(Boolean);
    const results = [];
    for (const file of files) {
        if (!/\.[cm]?[jt]sx?$/.test(file)) { results.push({file, errors: [], annotations: ['Non-source E2E change: semantic safety requires human review']}); continue; }
        const old = await run('git', ['show', `${base}:${file}`], {cwd, allowFailure: true});
        const current = head ? await run('git', ['show', `${head}:${file}`], {cwd, allowFailure: true}) : {stdout: await readFile(resolve(cwd, file), 'utf8').catch(() => '')};
        results.push({file, ...checkSource(old.code ? '' : old.stdout, current.stdout, file)});
    }
    return results;
}
main(import.meta.url, async () => {
    const results = await checkDiff(process.cwd(), process.env.TRIAGE_BASE_SHA, process.env.TRIAGE_HEAD_SHA);
    for (const r of results) {
        const file = r.file.replace(/[\r\n,%]/g, '_');
        for (const message of r.errors) console.log(`::error file=${file}::${message}`);
        for (const message of r.annotations) console.log(`::warning file=${file}::${message}`);
    }
    invariant(!results.some(r => r.errors.length), 'Mechanical E2E policy failed');
});
