// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

import {globSync} from 'glob';

import {legacyIds} from './ratchet.js';
import {
    crossFileDuplicates,
    extractSurface,
    indexSourceIds,
    type Diagnostic,
    type SourceIdIndex,
    type SurfaceEntry,
    type SurfaceReport,
} from './scan.js';

/**
 * Incremental scan keyed by per-file content hash. Each file is scanned on its own (grammar/role/key/drift/legacy and
 * in-file duplicates are all single-file checks) and its entries + diagnostics are cached; cross-file duplicates are
 * recomputed cheaply from the combined entries. Unchanged files reuse their cached result, so a warm run skips TS
 * parsing and a one-file change reparses one file. `--changed-since <ref>` reads only files git reports changed since
 * that ref and trusts the cache for the rest. Cache dir is gitignored and restorable by actions/cache.
 */
type FileCache = {
    hash: string;
    entries: SurfaceEntry[];
    diagnostics: Diagnostic[];
    literals: string[];
    patterns: string[];
    legacy: string[];
};
type Cache = {version: 2; files: Record<string, FileCache>};

const CACHE_VERSION = 2;

function hash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function collectFiles(roots: string[], cwd: string): string[] {
    const out = new Set<string>();
    for (const root of roots) {
        for (const file of globSync('**/*.{ts,tsx,js,jsx}', {
            cwd: resolve(cwd, root),
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.stories.*', '**/*.d.ts'],
        })) {
            out.add(file);
        }
    }
    return [...out].sort();
}

function changedSet(ref: string, cwd: string): Set<string> | undefined {
    try {
        const out = execFileSync('git', ['diff', '--name-only', ref, '--', '.'], {cwd, encoding: 'utf8'});
        return new Set(
            out
                .split('\n')
                .filter(Boolean)
                .map((p) => resolve(cwd, p)),
        );
    } catch {
        return undefined;
    }
}

function scanFile(
    rel: string,
    content: string,
    roleMap?: Record<string, string>,
    driftAllow?: Record<string, string>,
): Omit<FileCache, 'hash'> {
    const r = extractSurface({roots: [], files: {[rel]: content}, roleMap, driftAllow});
    const src = indexSourceIds({roots: [], files: {[rel]: content}});
    return {
        entries: r.entries,
        diagnostics: r.diagnostics,
        literals: [...src.literals],
        patterns: src.patterns.map((p) => p.source),
        legacy: legacyIds(content, rel),
    };
}

export function incrementalScan(options: {
    roots: string[];
    cwd: string;
    cacheDir: string;
    roleMap?: Record<string, string>;
    driftAllow?: Record<string, string>;
    changedSince?: string;
}): SurfaceReport & {
    cacheHits: number;
    cacheMisses: number;
    sourceIds: SourceIdIndex;
    legacy: Record<string, string[]>;
} {
    const started = performance.now();
    const cachePath = join(options.cacheDir, 'scan.json');
    const prev: Cache =
        existsSync(cachePath) && (JSON.parse(readFileSync(cachePath, 'utf8')) as Cache).version === CACHE_VERSION
            ? (JSON.parse(readFileSync(cachePath, 'utf8')) as Cache)
            : {version: CACHE_VERSION, files: {}};
    const changed = options.changedSince ? changedSet(options.changedSince, options.cwd) : undefined;

    const files = collectFiles(options.roots, options.cwd);
    const next: Cache = {version: CACHE_VERSION, files: {}};
    const entries: SurfaceEntry[] = [];
    const diagnostics: Diagnostic[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const file of files) {
        const rel = relative(options.cwd, file);
        const cached = prev.files[rel];
        // When --changed-since is given, a file git did not report changed is trusted from cache without reading it.
        const skipRead = changed && !changed.has(file) && cached;
        let fc: FileCache;
        if (skipRead) {
            fc = cached;
            cacheHits++;
        } else {
            const content = readFileSync(file, 'utf8');
            const h = hash(content);
            if (cached && cached.hash === h) {
                fc = cached;
                cacheHits++;
            } else {
                fc = {hash: h, ...scanFile(rel, content, options.roleMap, options.driftAllow)};
                cacheMisses++;
            }
        }
        next.files[rel] = fc;
        entries.push(...fc.entries);
        diagnostics.push(...fc.diagnostics);
    }

    diagnostics.push(...crossFileDuplicates(entries));
    diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));

    const scopes: SurfaceReport['scopes'] = {};
    const literals = new Set<string>();
    const patterns = new Map<string, RegExp>();
    const legacy: Record<string, string[]> = {};
    for (const [rel, fc] of Object.entries(next.files)) {
        for (const l of fc.literals) {
            literals.add(l);
        }
        for (const p of fc.patterns) {
            patterns.set(p, new RegExp(p));
        }
        if (fc.legacy.length > 0) {
            legacy[rel] = fc.legacy;
        }
    }
    for (const entry of entries) {
        scopes[entry.scope] ??= {parts: [], containerFiles: []};
        scopes[entry.scope].parts.push(entry);
    }

    mkdirSync(options.cacheDir, {recursive: true});
    writeFileSync(cachePath, JSON.stringify(next));

    return {
        entries,
        scopes,
        diagnostics,
        stats: {files: files.length, durationMs: Math.round(performance.now() - started)},
        cacheHits,
        cacheMisses,
        sourceIds: {literals, patterns: [...patterns.values()]},
        legacy,
    };
}
