// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import type {Config} from './config.ts';
import {typescript, useProjectTypeScript} from './typescript.ts';

export type LoadedProgram = {
    program: ts.Program;
    checker: ts.TypeChecker;
    options: ts.CompilerOptions;
    rootNames: string[];
    timings: {createProgram: number; getChecker: number};
};

/**
 * Compiler options from the project's tsconfig, with `paths` overridden so workspace packages
 * resolve to their source (the scan needs real code, e.g. Client4 URL templates, not built .d.ts).
 */
export function compilerSetup(config: Config): {options: ts.CompilerOptions; rootNames: string[]} {
    useProjectTypeScript(config.tsconfig);
    const read = typescript.readConfigFile(config.tsconfig, typescript.sys.readFile);
    if (read.error) {
        throw new Error(typescript.flattenDiagnosticMessageText(read.error.messageText, '\n'));
    }
    const parsed = typescript.parseJsonConfigFileContent(read.config, typescript.sys, path.dirname(config.tsconfig));
    assertDiagnostics(parsed.errors);
    const options: ts.CompilerOptions = {
        ...parsed.options,
        paths: {...(parsed.options.paths ?? {}), ...config.pathOverrides},
        composite: false,
        incremental: false,
        noEmit: true,
        declaration: false,
        tsBuildInfoFile: undefined,
    };
    return {options, rootNames: parsed.fileNames};
}

export function loadProgram(config: Config): LoadedProgram {
    const {options, rootNames} = compilerSetup(config);
    const t0 = Date.now();
    const host = typescript.createCompilerHost(options);
    host.getCurrentDirectory = () => path.dirname(config.tsconfig);
    const program = typescript.createProgram({rootNames, options, host});
    const t1 = Date.now();
    assertDiagnostics([...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics()]);
    const checker = program.getTypeChecker();
    const t2 = Date.now();
    return {program, checker, options, rootNames, timings: {createProgram: t1 - t0, getChecker: t2 - t1}};
}

/**
 * A long-lived language service for watch mode: one changed file costs an incremental
 * program update instead of a cold build.
 */
export class WatchedProgram {
    private readonly versions = new Map<string, number>();
    private readonly service: ts.LanguageService;
    readonly options: ts.CompilerOptions;
    private rootNames: string[];

    constructor(config: Config) {
        const setup = compilerSetup(config);
        this.options = setup.options;
        this.rootNames = setup.rootNames;
        const host: ts.LanguageServiceHost = {
            getScriptFileNames: () => this.rootNames,
            getScriptVersion: (f) => String(this.versions.get(f) ?? 0),
            getScriptSnapshot: (f) => {
                const text = typescript.sys.readFile(f);
                return text === undefined ? undefined : typescript.ScriptSnapshot.fromString(text);
            },
            getCurrentDirectory: () => path.dirname(config.tsconfig),
            getCompilationSettings: () => this.options,
            getDefaultLibFileName: (o) => typescript.getDefaultLibFilePath(o),
            fileExists: typescript.sys.fileExists,
            readFile: typescript.sys.readFile,
            readDirectory: typescript.sys.readDirectory,
            directoryExists: typescript.sys.directoryExists,
            getDirectories: typescript.sys.getDirectories,
        };
        this.service = typescript.createLanguageService(host, typescript.createDocumentRegistry());
    }

    /** Whether a file is one of the program's root files (from the tsconfig's `include`). */
    hasRoot(file: string): boolean {
        this.roots ??= new Set(this.rootNames.map((f) => path.resolve(f)));
        return this.roots.has(path.resolve(file));
    }
    private roots: Set<string> | null = null;

    /** Marks files as changed (or added/removed) on disk; `rootNames` replaces the root files when one was added or removed. */
    touch(files: string[], rootNames?: string[]) {
        if (rootNames) {
            this.rootNames = rootNames;
            this.roots = null;
        }
        for (const f of files) {
            this.versions.set(f, (this.versions.get(f) ?? 0) + 1);
        }
    }

    current(): LoadedProgram {
        const t0 = Date.now();
        const program = this.service.getProgram();
        if (!program) {
            throw new Error('language service produced no program');
        }
        const t1 = Date.now();
        assertDiagnostics([...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics()]);
        const checker = program.getTypeChecker();
        return {program, checker, options: this.options, rootNames: this.rootNames, timings: {createProgram: t1 - t0, getChecker: Date.now() - t1}};
    }
}

function assertDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
    const errors = diagnostics.filter((d) => d.category === typescript.DiagnosticCategory.Error);
    if (errors.length) {
        throw new Error(typescript.formatDiagnosticsWithColorAndContext(errors, {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: () => process.cwd(),
            getNewLine: () => '\n',
        }));
    }
}
