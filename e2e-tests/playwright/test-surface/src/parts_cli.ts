// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Config} from './config.ts';
import type {Diagnostic} from './manifest_types.ts';
import {FamilyParts, packageOf} from './parts.ts';
import {loadProgram} from './program.ts';
import {ProgramIndex} from './program_index.ts';
import {writeIfChanged} from './report.ts';
import {Roles} from './roles.ts';
import {Resolver} from './values.ts';

/** `test-surface parts`: scans the library and writes `output.parts`. */
export function writeParts(config: Config): {changed: boolean; components: number; parts: number; diagnostics: Diagnostic[]} {
    if (!config.library || !config.output.parts) {
        throw new Error('library mode needs "library" and "output.parts" in the config');
    }
    const ix = new ProgramIndex(loadProgram(config), config);
    const R = new Resolver(ix);
    const lib = new FamilyParts(ix, R, new Roles(ix, R), config.library);
    const parts = lib.build(config.library.entry, packageOf(config));
    const text = JSON.stringify(parts, null, 2) + '\n';
    const components = Object.values(parts.components);
    return {
        changed: writeIfChanged(config.output.parts, text),
        components: components.length,
        parts: components.reduce((n, c) => n + c.parts.length, 0),
        diagnostics: lib.diagnostics,
    };
}
