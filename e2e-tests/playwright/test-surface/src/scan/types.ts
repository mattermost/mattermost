// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {type JsxTag} from '../ast.ts';
import {type GrammarError, type ParsedTestId} from '../grammar.ts';
import {type Aria, type Diagnostic, type Loc, type Manifest, type RuleName, type TestPart} from '../manifest_types.ts';
import {type CodeNode} from '../program_index.ts';
import type {TextEntry} from '../role_table.ts';
import {type Value} from '../values.ts';

export type SiteKind = 'dom' | 'component' | 'object' | 'part' | 'html';

/** A place where a data-testid is written. */
export type Site = {
    node: ts.Node;
    at: Loc;
    kind: SiteKind;
    tag: JsxTag | null;
    expr: ts.Expression | undefined;
    owner: CodeNode | null;
    ownerName: string;
    values: Value[];

    /** Component sites whose value is already emitted by a DOM site inside the component. */
    forwarded?: boolean;

    /** Part sites: the published part of a library component (`<Modal testId>` -> `.close--button`). */
    part?: TestPart & {component: string};

    /** HTML sites: the tag of `<span data-testid="x">` written inside a string (markup built for `dangerouslySetInnerHTML`). */
    htmlTag?: string;
    htmlAttrs?: string;
};

/** Where a site's testid ends up in the DOM, for one instance. */
export type Landing = {
    tag: JsxTag | null;
    aria: Aria;

    native?: 'file';
    textEntry?: TextEntry;

    /** The node whose render conditions apply. */
    anchor: ts.Node;
    interactive: boolean;
};

/** One testid value produced by one site for one instance. */
export type Emission = {
    site: Site;
    value: Value;
    template: string;
    key: string | null;
    parsed: ParsedTestId | GrammarError;
    via: Loc[];
    landing: Landing;
};

export type ScanStats = Record<string, number | Record<string, number>>;

export type ScanResult = {

    /** The manifest with exact locations (`file:line:column`), which checks and `test-surface where` read. */
    manifest: Manifest;

    stats: ScanStats;
    sites: Site[];
    emissions: Emission[];

    /** Per occurrence, before report serialization. */
    specGaps: Array<{client: string; verb: string; path: string}>;

    /** The node a usage location points at (for checks that compare positions along usage chains). */
    /** Whether this source location and every call-site file on its path are imported from configured entries. */
    isReachable?: (at: Loc, via?: Loc[]) => boolean;
    notReachableFiles?: string[];
    usageNodeAt: (loc: Loc) => ts.Node | undefined;
    uniqueMountChain?: (node: ts.Node) => ts.Node[];
    propRenderUses: (creation: ts.Node, mount: ts.Node) => ts.Node[] | undefined;
    usageNameAt: (loc: Loc) => string | undefined;
    scopeOwnerAt: (scope: string, via: Loc[], declaration?: boolean) => string | undefined;
    allOperations: Array<{opId: string; verb: string; path: string; body: string | null; bodyImports?: Record<string, string>}>;

    /** The REST client's URL prefix (`/api/v4`), for the summary. */
    urlVersion: string | null;

    /** What the scan itself found wrong (unreadable inputs, `pageReady`, truncated navigations); checks add the rest. */
    diagnostics: Diagnostic[];
};

export type HostSlot = {slot: string; template: string};

/** Emit one scanner diagnostic without coupling discovery modules to the result builder. */
export type ScanDiagnostic = (rule: RuleName, severity: Diagnostic['severity'], at: Loc, message: string, fix?: string) => void;
