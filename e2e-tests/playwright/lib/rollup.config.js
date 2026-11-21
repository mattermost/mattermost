// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

/**
 * The emitted declarations keep the source's `@/…` path alias, which only resolves inside the lib: in a test project
 * every type that goes through one silently becomes `any`. Rewrite them to relative paths.
 */
function relativeDeclarationAliases() {
    const walk = (dir) =>
        fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                return walk(p);
            }
            return e.name.endsWith('.d.ts') ? [p] : [];
        });
    return {
        name: 'relative-declaration-aliases',
        writeBundle(options) {
            const root = path.resolve(options.dir);
            for (const file of walk(root)) {
                const text = fs.readFileSync(file, 'utf8');
                const next = text.replace(/(['"])@\/([^'"]+)\1/g, (_, quote, target) => {
                    let rel = path.relative(path.dirname(file), path.join(root, target)).split(path.sep).join('/');
                    if (!rel.startsWith('.')) {
                        rel = './' + rel;
                    }
                    return quote + rel + quote;
                });
                if (next !== text) {
                    fs.writeFileSync(file, next);
                }
            }
        },
    };
}

/**
 * The testid grammar and the action verbs are the tool's (`@mattermost/test-surface/grammar` and `/verbs`, plain
 * JavaScript with their declarations): the published lib carries a copy of each, so it doesn't depend on the tool. Each
 * import resolves to the copy's source, emitted as `dist/aria/test_surface_<name>.js`, and the lib's re-exporting
 * declarations point at its `.d.ts` beside it.
 */
const BUNDLED = ['grammar', 'verbs'].map((name) => ({
    id: `@mattermost/test-surface/${name}`,
    source: path.resolve(`../test-surface/lint/${name}.js`),
    declarations: path.resolve(`../test-surface/lint/${name}.d.ts`),
    out: `aria/test_surface_${name}`,
    reexport: `aria/${name}.d.ts`,
}));
function bundledToolModules() {
    return {
        name: 'bundled-tool-modules',
        resolveId(id) {
            return BUNDLED.find((m) => m.id === id)?.source ?? null;
        },
        writeBundle(options) {
            const root = path.resolve(options.dir);
            for (const m of BUNDLED) {
                fs.copyFileSync(m.declarations, path.join(root, `${m.out}.d.ts`));
                const reexport = path.join(root, m.reexport);
                const text = fs.readFileSync(reexport, 'utf8');
                fs.writeFileSync(reexport, text.split(`'${m.id}'`).join(`'./${path.basename(m.out)}'`));
            }
        },
    };
}

export default {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'esm',
            sourcemap: true,
            preserveModules: true, // Keep file structure
            preserveModulesRoot: 'src',
            entryFileNames: (chunk) => {
                const bundled = BUNDLED.find((m) => m.source === chunk.facadeModuleId);
                return bundled ? `${bundled.out}.js` : '[name].js';
            },
        },
    ],
    plugins: [
        bundledToolModules(),
        typescript(),
        relativeDeclarationAliases(),
        copy({
            targets: [
                {src: 'src/asset/**/*', dest: 'dist/asset'}, // Copy assets to dist/
                {src: 'src/containers/assets/**/*', dest: 'dist/containers/assets'},
            ],
        }),
    ],
    external: [
        '@playwright/test',
        '@mattermost/client',
        '@mattermost/types/config',
        '@axe-core/playwright',
        '@azure/storage-blob',
        '@percy/playwright',
        '@testcontainers/postgresql',
        '@expo/devcert',
        'dotenv',
        'intl-messageformat',
        'ldapts',
        'luxon',
        'minio',
        'node:child_process',
        'node:crypto',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:net',
        'node:os',
        'node:url',
        'node:util',
        'node:zlib',
        'mime-types',
        'testcontainers',
        'uuid',
        'async-wait-until',
        'chalk',
    ],
};
