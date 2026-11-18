// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createRequire} from 'node:module';

import type ts from 'typescript';

/** Runtime compiler follows the scanned project's resolution; types follow this workspace's compiler. */
export let typescript: typeof ts;

export function useProjectTypeScript(tsconfig: string): void {
    try {
        typescript = createRequire(tsconfig)('typescript') as typeof ts;
    } catch (cause) {
        throw new Error(`Cannot load TypeScript from ${tsconfig}. Install the scanned project's dependencies.`, {cause});
    }
}
