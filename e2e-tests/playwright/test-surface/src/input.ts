// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import type {Diagnostic} from './manifest_types.ts';

/** A file another run of the tool wrote, and the format version this one reads. */
export type Versioned = {version: number};

/** An `input` diagnostic: a file the scan or the generator reads is missing, unreadable, or of another format version. */
export function inputDiagnostic(at: string, message: string, fix: string, severity: Diagnostic['severity'] = 'error'): Diagnostic {
    return {rule: 'input', severity, at, message, fix};
}

/**
 * Reads a JSON file another run of the tool wrote (a surface report or a library's `test-parts.json`) and checks its format version: a missing, corrupt or differently versioned file is an `input`
 * error, never an empty result.
 */
export function readVersioned<T extends Versioned>(file: string, version: number, what: string, at = file): {value: T} | {diagnostic: Diagnostic} {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return {diagnostic: inputDiagnostic(at, `${what} is missing (${file}).`, 'Generate it, or fix the path in the surface config.')};
    }
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (e) {
        return {diagnostic: inputDiagnostic(at, `${what} isn't valid JSON: ${(e as Error).message}.`, 'Regenerate it (and take neither side of a merge conflict: rerun the tool).')};
    }
    const found = value && typeof value === 'object' ? (value as {version?: unknown}).version : undefined;
    if (found !== version) {
        return {diagnostic: inputDiagnostic(at, `${what} was written by test-surface format v${String(found)}; this version reads v${version}.`, 'Regenerate it with this version of the tool, or use the tool version that wrote it.')};
    }
    return {value: value as T};
}
