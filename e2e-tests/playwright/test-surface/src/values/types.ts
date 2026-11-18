// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {type KeyFieldAllow, type KeyValue} from '../config.ts';
import type {KeyKind} from '../manifest_types.ts';
import {type CodeNode, type Loc} from '../program_index.ts';

/** Runtime data that fills a slot of a testid. */
export type Gap = {

    /**
     * number; set = a union of string literals; entity = a field of a type from the entity dirs;
     * id = a configured canonical identity; string = anything else
     */
    kind: KeyKind;
    type: string;
    expr: string;
    entity?: string;
    field?: string;

    /** Module the entity type is imported from (`@mattermost/types/channels`). */
    module?: string;

    /** Canonical declaration identity, retained internally until key origins are aggregated. */
    entityIdentity?: string;
    value?: string;
    freeForm?: boolean;
    fieldEntry?: KeyFieldAllow;
    keyValueEntry?: KeyValue;
    values?: string[];

    /** Where the value that couldn't be read is, when that is a mount's expression rather than `expr` itself. */
    from?: Loc;
};

export type Part = string | {gap: Gap};

/** A pattern as a TS template literal type: its literal parts kept, its runtime parts any string. */

/**
 * `via`: the usage chain a value came through. `arms`: the ternary arms it was chosen in, by the
 * condition's identity (`isScheduledPost ? a : b` twice in one template: an `a` with the other's `b`
 * can't happen).
 */
export type Via = {via?: Loc[]; arms?: Arm[]; setSource?: string};

export type Arm = {key: string; when: boolean; origins?: string[]};

export type Value =
    | ({k: 'lit'; s: string; primitive?: 'number' | 'boolean'} & Via) |
    ({k: 'pat'; parts: Part[]; libraryRendered?: boolean; recursive?: boolean} & Via) |
    ({k: 'absent'; at?: Loc; nullValue?: true} & Via) |
    ({k: 'computed'; at: Loc; truthy?: true} & Via) |
    ({k: 'unres'; why: string; at: Loc; truthy?: true} & Via);

/** A source expression a value can come from, with the usage chain it flowed through. */
export type Source = ({expr: ts.Expression; via: Loc[]} | {marker: true; src: ts.Expression; via: Loc[]}) & {arms?: Arm[]};

export type Env = Map<ts.Symbol, {expr: ts.Expression; env: Env | null}>;

export type PropsRef = {path: string[]; comp: CodeNode | null};

/** Where a prop comes from at one usage of a component. */
export type PropAt =
    | {kind: 'value'; expr: ts.Expression; rest: string[]} |
    {kind: 'true'} |
    {kind: 'up'; comp: CodeNode; path: string[]} |
    {kind: 'object'; expr: ts.Expression; path: string[]} |
    {kind: 'unknown'; node: ts.Node} |
    {kind: 'default'; expr: ts.Expression} |
    {kind: 'connect'} |
    {kind: 'absent'};

export type Unresolved = Value & {k: 'unres'};
