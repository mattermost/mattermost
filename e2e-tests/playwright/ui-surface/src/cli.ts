// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {emitGenerated, extractOpenApi, type PageSpec} from './catalog.js';
import {diffHostContracts, extractHostContract, readHostVersion, type HostContract} from './host_contract.js';
import {incrementalScan} from './cache.js';
import {baselineFromLegacy, computeBaseline, diffBaseline, serializeBaseline, type Baseline} from './ratchet.js';
import {analyzeSpecMigration, migrateTestIds, surfaceIdMap} from './migrate.js';
import {checkStaleRefs, collectTestIdSurfacePairs, extractSurface, indexSourceIds, type SurfaceEntry, type SurfaceReport} from './scan.js';

function defaultPaths(cwd = process.cwd()) {
    const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const pwRoot = resolve(pkgDir, '..');
    const repoRoot = resolve(pwRoot, '../..');
    return {
        cwd,
        pkgDir,
        pwRoot,
        repoRoot,
        webappRoots: ['webapp/channels/src', 'webapp/platform/components/src'].map((p) => resolve(repoRoot, p)),
        // Page objects in lib/src hold most selectors, so a renamed id must fail there too.
        specRoots: [
            'e2e-tests/playwright/specs',
            'e2e-tests/playwright/upgrade-specs',
            'e2e-tests/playwright/lib/src',
        ].map((p) => resolve(repoRoot, p)),
        apiSourceDir: resolve(repoRoot, 'api/v4/source'),
        enJsonPath: resolve(repoRoot, 'webapp/channels/src/i18n/en.json'),
        registryPath: resolve(repoRoot, 'webapp/channels/src/plugins/registry.ts'),
        pluginTypesPath: resolve(repoRoot, 'webapp/platform/types/src/plugins.ts'),
        slotsPath: resolve(pkgDir, 'plugin-slots.json'),
        pagesPath: resolve(pkgDir, 'pages.json'),
        staleAllowPath: resolve(pkgDir, 'stale-allow.json'),
        roleMapPath: resolve(pkgDir, 'role-map.json'),
        baselinePath: resolve(pkgDir, 'testid-baseline.json'),
        driftMapPath: resolve(pkgDir, 'testid-surface-map.json'),
        generatedDir: resolve(pwRoot, 'lib/src/surface/generated'),
    };
}

function readFlag(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
}

function buildPageMap(
    pageName: string | undefined,
    scopeFilter: string | undefined,
    surface: SurfaceReport,
    pages: Record<string, PageSpec>,
    ops: ReturnType<typeof extractOpenApi>,
) {
    let selectedPages = pages;
    if (pageName) {
        selectedPages = pages[pageName] ? {[pageName]: pages[pageName]} : {};
    }
    const scopeMap: Record<string, SurfaceEntry[]> = {};
    for (const [scope, data] of Object.entries(surface.scopes)) {
        if (!scopeFilter || scope.includes(scopeFilter)) {
            scopeMap[scope] = data.parts;
        }
    }
    const needle = (scopeFilter ?? pageName ?? '').replace(/s$/, '');
    const relatedApis = needle
        ? ops.filter((op) => op.path.includes(needle) || op.id.toLowerCase().includes(needle)).slice(0, 30)
        : [];
    return {pages: selectedPages, scopes: scopeMap, apis: relatedApis};
}

function formatMapMarkdown(map: ReturnType<typeof buildPageMap>): string {
    const lines: string[] = [];
    for (const [name, page] of Object.entries(map.pages)) {
        lines.push(
            `## Page: ${name}`,
            `- Route: \`${page.path}\``,
            `- Ready: ${page.ready.map((r) => `\`${r}\``).join(', ')}`,
            '',
        );
    }
    for (const [scope, parts] of Object.entries(map.scopes)) {
        lines.push(`### Scope: \`${scope}\` (${parts.length} parts)`);
        for (const p of parts.slice(0, 40)) {
            lines.push(`- \`${p.id}\` (${p.role}${p.keyed ? ', keyed' : ''}) — ${p.file}:${p.line}`);
        }
        lines.push('');
    }
    if (map.apis.length > 0) {
        lines.push('### Related APIs');
        for (const op of map.apis) {
            lines.push(`- \`Api.${op.id}\`: ${op.method} \`${op.path}\``);
        }
    }
    return `${lines.join('\n')}\n`;
}

/** Run the `@mattermost/ui-surface` CLI and return a process exit code. */
export async function runCli(argv: string[]): Promise<number> {
    const [cmd, sub, ...rest] = argv;
    const paths = defaultPaths();
    const out = (text: string) => process.stdout.write(text);
    const err = (text: string) => process.stderr.write(text);

    if (!cmd || cmd === '--help' || cmd === '-h') {
        out('Usage: ui-surface <scan|check|baseline|generate|map|find|host-contract|explain|migrate-testid|migrate-spec> [options]\n');
        return 0;
    }

    if (cmd === 'host-contract' && sub === 'diff') {
        const [baseFile, headFile] = rest;
        if (!baseFile || !headFile) {
            err('Usage: ui-surface host-contract diff <base.json> <head.json>\n');
            return 2;
        }
        const base = JSON.parse(readFileSync(resolve(baseFile), 'utf8')) as HostContract;
        const head = JSON.parse(readFileSync(resolve(headFile), 'utf8')) as HostContract;
        const diff = diffHostContracts(base, head);
        out(JSON.stringify(diff, null, 2) + '\n');
        return diff.breaking.length > 0 ? 1 : 0;
    }

    const roots = readFlag(argv, '--root')
        ? [resolve(readFlag(argv, '--root')!)]
        : paths.webappRoots.filter(existsSync);
    const roleMap = existsSync(paths.roleMapPath)
        ? (JSON.parse(readFileSync(paths.roleMapPath, 'utf8')) as Record<string, string>)
        : {};
    const driftAllow = existsSync(paths.driftMapPath)
        ? (JSON.parse(readFileSync(paths.driftMapPath, 'utf8')) as Record<string, string>)
        : {};
    const incremental = argv.includes('--incremental');
    const changedSince = readFlag(argv, '--changed-since');
    const cacheDir = resolve(readFlag(argv, '--cache-dir') ?? resolve(paths.pwRoot, '.ui-surface-cache'));
    const inc =
        incremental && (cmd === 'check' || cmd === 'scan')
            ? incrementalScan({roots, cwd: paths.repoRoot, cacheDir, roleMap, driftAllow, changedSince})
            : undefined;
    const surface = inc ?? extractSurface({roots, cwd: paths.repoRoot, roleMap, driftAllow});

    if (cmd === 'scan') {
        const outFile = readFlag(argv, '--out');
        const payload = JSON.stringify(surface, null, 2) + '\n';
        if (outFile) {
            writeFileSync(resolve(outFile), payload);
        } else {
            out(
                `Scanned ${surface.stats.files} files in ${surface.stats.durationMs}ms: ${surface.entries.length} ids, ${Object.keys(surface.scopes).length} scopes, ${surface.diagnostics.length} diagnostics\n`,
            );
        }
        return 0;
    }

    if (cmd === 'check') {
        const specRoots = readFlag(argv, '--specs')
            ? [resolve(readFlag(argv, '--specs')!)]
            : paths.specRoots.filter(existsSync);
        const knownIds = new Set(surface.entries.map((e) => e.id));
        const sourceIds = inc ? inc.sourceIds : indexSourceIds({roots, cwd: paths.repoRoot});
        const allowed: Record<string, string> = existsSync(paths.staleAllowPath)
            ? JSON.parse(readFileSync(paths.staleAllowPath, 'utf8'))
            : {};
        const allow = new Set(Object.keys(allowed));
        const stale = checkStaleRefs({specRoots, cwd: paths.repoRoot, knownIds, sourceIds, allow});

        // An allow entry nothing references, or one the webapp now renders, is dead weight; drop it so the list stays honest.
        const referenced = new Set(
            checkStaleRefs({specRoots, cwd: paths.repoRoot, knownIds, sourceIds}).map((d) => d.id),
        );
        const unusedAllow = [...allow].filter((id) => !referenced.has(id));
        for (const id of unusedAllow) {
            err(`ui-surface/stale-allow.json: "${id}" is no longer a stale reference; remove the entry\n`);
        }
        // Ratchet: a new legacy data-testid (non-grammar, not paired with data-surface) that grows a file's count fails.
        const committed: Baseline = existsSync(paths.baselinePath)
            ? (JSON.parse(readFileSync(paths.baselinePath, 'utf8')) as Baseline)
            : {};
        const current = inc ? baselineFromLegacy(inc.legacy) : computeBaseline({roots, cwd: paths.repoRoot});
        const ratchet = diffBaseline(committed, current);
        for (const g of ratchet.grown) {
            err(
                `${g.file}:1 [legacy-testid] — ${g.to - g.from} new legacy data-testid(s) (was ${g.from}, now ${g.to}); make new ids grammar (scope.name--role) or pair each with data-surface, or run \`ui-surface baseline --update\` to retire the gain only if intentional\n`,
            );
        }

        const allDiags = [...surface.diagnostics, ...stale];
        for (const d of allDiags) {
            err(`${d.file}:${d.line} [${d.rule}] ${d.id} — ${d.message}\n`);
        }
        const issues = allDiags.length + ratchet.grown.length;
        out(
            `Checked ${surface.stats.files} webapp files in ${surface.stats.durationMs}ms (${issues} issues)\n`,
        );
        return issues > 0 || unusedAllow.length > 0 ? 1 : 0;
    }

    if (cmd === 'baseline') {
        const committed: Baseline = existsSync(paths.baselinePath)
            ? (JSON.parse(readFileSync(paths.baselinePath, 'utf8')) as Baseline)
            : {};
        const current = computeBaseline({roots, cwd: paths.repoRoot});
        const diff = diffBaseline(committed, current);
        if (sub === '--update') {
            if (diff.grown.length > 0 && !argv.includes('--allow-growth')) {
                for (const g of diff.grown) {
                    err(`${g.file}: legacy data-testid count would grow ${g.from} -> ${g.to}\n`);
                }
                err('Refusing to grow the testid baseline. Fix the new ids, or pass --allow-growth to record them deliberately.\n');
                return 1;
            }
            writeFileSync(paths.baselinePath, serializeBaseline(current));
            const total = Object.values(current).reduce((n, f) => n + f.count, 0);
            out(`Updated testid baseline: ${Object.keys(current).length} files, ${total} legacy ids.\n`);
            return 0;
        }
        out(
            `Baseline diff: ${diff.grown.length} grown, ${diff.shrunk.length} shrunk, ${diff.changed.length} changed (same count).\n`,
        );
        for (const g of diff.grown) {
            err(`grew ${g.file}: ${g.from} -> ${g.to}\n`);
        }
        return diff.grown.length > 0 ? 1 : 0;
    }

    if (cmd === 'drift') {
        const pairs = collectTestIdSurfacePairs({roots, cwd: paths.repoRoot});
        if (sub === '--update') {
            const doc = {
                _doc: 'Intentional legacy data-testid -> data-surface pairings for elements that carry both. A dual element whose pair is not listed here (and whose attrs differ) fails the drift check. Retire a legacy id with `ui-surface migrate-testid` and remove its entry.',
            };
            writeFileSync(paths.driftMapPath, JSON.stringify({...doc, ...pairs}, null, 4) + '\n');
            out(`Updated testid-surface drift map: ${Object.keys(pairs).length} dual pairings.\n`);
            return 0;
        }
        out(`${Object.keys(pairs).length} elements carry both data-testid and data-surface with differing values.\n`);
        return 0;
    }

    if (cmd === 'migrate-testid') {
        const apply = argv.includes('--apply');
        const specRoots = paths.specRoots.filter(existsSync);
        const driftMap = existsSync(paths.driftMapPath)
            ? (JSON.parse(readFileSync(paths.driftMapPath, 'utf8')) as Record<string, string>)
            : {};
        const result = migrateTestIds({
            webappRoots: roots,
            specRoots,
            cwd: paths.repoRoot,
            driftMap,
            apply,
            only: readFlag(argv, '--only'),
        });
        out(JSON.stringify(result.summary, null, 2) + '\n');
        if (!apply) {
            out('Dry run (no files changed). Re-run with --apply to write, --only <path-substring> to limit scope.\n');
        }
        return 0;
    }

    if (cmd === 'migrate-spec') {
        const specRoots = paths.specRoots.filter(existsSync);
        const result = analyzeSpecMigration({
            specRoots,
            cwd: paths.repoRoot,
            surfaceIds: surfaceIdMap(surface.entries),
            legacyToSurface: driftAllow,
        });
        const outFile = readFlag(argv, '--out');
        if (outFile) {
            writeFileSync(resolve(outFile), JSON.stringify(result, null, 2) + '\n');
        }
        out(JSON.stringify(result.summary, null, 2) + '\n');
        out('Dry run: coverage analysis only. Migrate a spec only when its migration type-checks and lints clean.\n');
        return 0;
    }

    const pages = JSON.parse(readFileSync(paths.pagesPath, 'utf8')) as Record<string, PageSpec>;
    const ops = extractOpenApi(
        paths.apiSourceDir,
        cmd === 'generate' ? (message) => err(`warning: ${message}\n`) : undefined,
    );

    if (cmd === 'generate') {
        const outDir = resolve(readFlag(argv, '--out-dir') ?? paths.generatedDir);
        const result = emitGenerated({outDir, surface, ops, pages, enJsonPath: paths.enJsonPath});
        out(
            `Generated ${result.files.length} files (${ops.length} APIs, ${surface.entries.length} elements) in ${outDir}\n`,
        );
        return 0;
    }

    if (cmd === 'map') {
        const map = buildPageMap(readFlag(argv, '--page'), readFlag(argv, '--scope'), surface, pages, ops);
        const format = readFlag(argv, '--format') ?? 'json';
        out(format === 'md' ? formatMapMarkdown(map) : JSON.stringify(map, null, 2) + '\n');
        return 0;
    }

    if (cmd === 'find') {
        const query = (sub ?? '').toLowerCase();
        const elements = surface.entries.filter((e) => e.id.toLowerCase().includes(query)).slice(0, 25);
        const apis = ops
            .filter((o) => o.id.toLowerCase().includes(query) || o.path.toLowerCase().includes(query))
            .slice(0, 25);
        out(JSON.stringify({elements, apis}, null, 2) + '\n');
        return 0;
    }

    if (cmd === 'host-contract') {
        const contract = extractHostContract({
            version: readHostVersion(paths.repoRoot),
            slotsPath: paths.slotsPath,
            apiSourceDir: paths.apiSourceDir,
            registryPath: paths.registryPath,
            pluginTypesPath: paths.pluginTypesPath,
            surface,
        });
        const json = JSON.stringify(contract);
        const outFile = readFlag(argv, '--out');
        if (outFile) {
            writeFileSync(resolve(outFile), json + '\n');
        }
        out(
            `Host contract v${contract.mattermostVersion}: ${Object.keys(contract.slots).length} slots, ${Object.keys(contract.api).length} APIs, ${Object.keys(contract.registry.methods).length} registry methods (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB compact JSON)\n`,
        );
        return 0;
    }

    err(`Unknown command: ${cmd}\n`);
    return 2;
}
