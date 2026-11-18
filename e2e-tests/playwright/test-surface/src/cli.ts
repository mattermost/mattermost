// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';

import {runChecks} from './checks.ts';
import {findConfig, loadConfig, relativeToRoot, type Config} from './config.ts';
import {readVersioned} from './input.ts';
import type {Diagnostic, Manifest} from './manifest_types.ts';
import {loadProgram} from './program.ts';
import {formatDiagnostic, summary, templateMatcher, unrenderedTestIds, writeIfChanged, writeReports} from './report.ts';
import {REPORT_VERSION, serialize, type SurfaceReport} from './report_types.ts';
import {Scanner, type ScanResult} from './scan.ts';
import {staleReferences} from './stale_refs.ts';
import {buildSurfaceReport} from './surface_report.ts';

const USAGE = `test-surface <command> [--config <path>]

Commands:
  scan       Scan the TypeScript program, run checks, write the configured v4 surface report.
  check      Scan and run checks without writing; exit 1 on errors or a stale report.
  report     Scan and write human-readable reports (spec gaps, diagnostics).
  generate   Generate the typed Playwright page objects from the surface report (reads only the report and i18n).
  watch      Keep the program warm and rescan + regenerate when files change.
  parts      Library mode: write test-parts.json (the testids each component derives from testId).
  install-hooks  Opt-in git hooks for this config: pre-commit lints staged testids; pre-push scans, checks and
                 regenerates (and stops when the working tree has edits the push doesn't).
  where <testid> Scan and print the exact places (file:line:column) that render a testid or template, and the
                 usage chains it comes through: these locations are scan provenance.

Options:
  --config <path>   Surface config (default: nearest test-surface.config.json at or above cwd)
  --quiet           Only print errors.
  --all             Print every diagnostic, not just errors.
`;

export type ScanOutput = {result: ScanResult; manifest: Manifest; report: SurfaceReport; diagnostics: Diagnostic[]};

export function scanProject(config: Config): ScanOutput {
    const loaded = loadProgram(config);
    const scanner = new Scanner(loaded, config);
    const result = scanner.scan();
    const report = buildSurfaceReport(result, config);
    const diagnostics = runChecks(result, {...config.checks, keyValues: config.keyValues, plugin: config.plugin, pluginSlots: config.pluginSlots, configAt: relativeToRoot(config, config.configPath)});
    return {result, manifest: result.manifest, report, diagnostics};
}

export async function main(argv: string[]): Promise<number> {
    const {values, positionals} = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            config: {type: 'string'},
            quiet: {type: 'boolean', default: false},
            all: {type: 'boolean', default: false},
            help: {type: 'boolean', short: 'h', default: false},
        },
    });
    const cmd = positionals[0];
    if (!cmd || values.help) {
        console.log(USAGE);
        return cmd ? 0 : 1;
    }
    const config = loadConfig(findConfig(values.config));
    const log = (s: string) => {
        if (!values.quiet) {
            console.log(s);
        }
    };
    const printDiagnostics = (ds: Diagnostic[]) => {
        for (const d of ds) {
            if (d.severity === 'error' || values.all) {
                console.log(formatDiagnostic(d));
            }
        }
    };

    switch (cmd) {
    case 'scan':
    case 'check':
    case 'report': {
        const {result, manifest, report, diagnostics} = scanProject(config);
        const text = serialize(report);

        // tests that query testids the app no longer renders: errors with the rest, but not stored in the manifest,
        // so they fail the command without keeping `scan` from writing the report (which depends on the app only)
        const stale = staleReferences(manifest, config);
        printDiagnostics([...diagnostics, ...stale]);
        log(summary(result, [...diagnostics, ...stale]));
        const errors = diagnostics.filter((d) => d.severity === 'error').length;
        const staleErrors = stale.filter((d) => d.severity === 'error').length;
        if (cmd === 'scan' && !errors) {
            const changed = writeIfChanged(config.output.report, text);
            log(`${changed ? 'wrote' : 'unchanged'} ${relativeToRoot(config, config.output.report)}`);
        }
        if (cmd === 'report' && config.output.reports) {
            const tests = testFiles(config.include).map((f) => ({path: relativeToRoot(config, f), text: fs.readFileSync(f, 'utf8')}));
            writeReports(config.output.reports, result, [...diagnostics, ...stale], unrenderedTestIds(manifest, tests), config.checks);
            log(`reports in ${relativeToRoot(config, config.output.reports)}`);
        }
        if (cmd === 'check') {
            const current = fs.existsSync(config.output.report) ? fs.readFileSync(config.output.report, 'utf8') : '';
            if (current !== text) {
                console.log(`✗ ${relativeToRoot(config, config.output.report)} is stale. Run \`test-surface scan\` and commit the result.`);
                return 1;
            }
        }
        return errors || staleErrors ? 1 : 0;
    }
    case 'where': {
        const query = positionals[1];
        if (!query) {
            console.log(USAGE);
            return 1;
        }
        const {result} = scanProject(config);
        const found = result.manifest.elements.filter((e) => e.template === query || templateMatcher(e.template)?.test(query));
        for (const e of found) {
            console.log(e.template);
            for (const at of [e.component.at, ...(e.alsoAt ?? [])]) {
                console.log(`  rendered at ${at}`);
            }
            for (const via of new Set(e.instances.filter((i) => i.via.length).map((i) => i.via.join(' < ')))) {
                console.log(`  through ${via}`);
            }
        }
        if (!found.length) {
            console.log(`No testid in the scan matches "${query}".`);
        }
        return found.length ? 0 : 1;
    }
    case 'generate': {
        const {generate} = await import('./generate/index.ts');
        const read = readVersioned<SurfaceReport>(config.output.report, REPORT_VERSION, 'The surface report', relativeToRoot(config, config.output.report));
        if ('diagnostic' in read) {
            console.log(formatDiagnostic(read.diagnostic));
            return 1;
        }
        const out = generate(read.value, config);
        for (const d of out.diagnostics) {
            console.log(formatDiagnostic(d));
        }
        log(`generated ${out.files.length} files into ${relativeToRoot(config, config.output.generated!)} (${out.changed} changed)`);
        return out.diagnostics.some((d) => d.severity === 'error') ? 1 : 0;
    }
    case 'parts': {
        const {writeParts} = await import('./parts_cli.ts');
        const out = writeParts(config);
        printDiagnostics(out.diagnostics);
        log(`${out.changed ? 'wrote' : 'unchanged'} ${relativeToRoot(config, config.output.parts!)}: ${out.components} components, ${out.parts} parts`);
        return out.diagnostics.some((d) => d.severity === 'error') ? 1 : 0;
    }
    case 'install-hooks': {
        const {installHooks} = await import('./hooks.ts');
        installHooks(config.configPath, log);
        return 0;
    }
    case 'watch': {
        const {watch} = await import('./watch.ts');
        await watch(config, log);
        return 0;
    }
    default:
        console.log(USAGE);
        return 1;
    }
}

/** Unit test files under the scanned directories. */
function testFiles(dirs: string[]): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const e of fs.readdirSync(d, {withFileTypes: true})) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) {
                continue;
            }
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if ((/\.test\.tsx?$/).test(e.name)) {
                out.push(p);
            }
        }
    };
    for (const d of dirs) {
        if (fs.existsSync(d)) {
            walk(d);
        }
    }
    return out.sort();
}
