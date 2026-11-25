// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {emitGenerated, extractOpenApi, type PageSpec} from './catalog.js';
import {checkStaleRefs, extractSurface, indexSourceIds} from './scan.js';

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
        pagesPath: resolve(pkgDir, 'pages.json'),
        staleAllowPath: resolve(pkgDir, 'stale-allow.json'),
        generatedDir: resolve(pwRoot, 'lib/src/surface/generated'),
    };
}

function readFlag(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
}

/** Run the `@mattermost/ui-surface` CLI and return a process exit code. */
export async function runCli(argv: string[]): Promise<number> {
    const [cmd] = argv;
    const paths = defaultPaths();
    const out = (text: string) => process.stdout.write(text);
    const err = (text: string) => process.stderr.write(text);

    if (!cmd || cmd === '--help' || cmd === '-h') {
        out('Usage: ui-surface <scan|check|generate> [options]\n');
        return 0;
    }

    const roots = readFlag(argv, '--root')
        ? [resolve(readFlag(argv, '--root')!)]
        : paths.webappRoots.filter(existsSync);
    const surface = extractSurface({roots, cwd: paths.repoRoot});

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
        const sourceIds = indexSourceIds({roots, cwd: paths.repoRoot});
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
        const allDiags = [...surface.diagnostics, ...stale];
        for (const d of allDiags) {
            err(`${d.file}:${d.line} [${d.rule}] ${d.id} — ${d.message}\n`);
        }
        out(
            `Checked ${surface.stats.files} webapp files in ${surface.stats.durationMs}ms (${allDiags.length} issues)\n`,
        );
        return allDiags.length > 0 || unusedAllow.length > 0 ? 1 : 0;
    }

    if (cmd === 'generate') {
        const pages = JSON.parse(readFileSync(paths.pagesPath, 'utf8')) as Record<string, PageSpec>;
        const ops = extractOpenApi(paths.apiSourceDir, (message) => err(`warning: ${message}\n`));
        const outDir = resolve(readFlag(argv, '--out-dir') ?? paths.generatedDir);
        const result = emitGenerated({outDir, surface, ops, pages, enJsonPath: paths.enJsonPath});
        out(
            `Generated ${result.files.length} files (${ops.length} APIs, ${surface.entries.length} elements) in ${outDir}\n`,
        );
        return 0;
    }

    err(`Unknown command: ${cmd}\n`);
    return 2;
}
