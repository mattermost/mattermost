// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The values module's single entry point: the Resolver, the value types, and the value helpers other modules use.

export {Resolver} from './resolve.ts';
export {concat, distribute, gapsOf, isTruncated, lit, perInstance, templateOf, TOO_MANY_VALUES} from './algebra.ts';
export {assignmentsOf, pushesOf, stringLiteralsOf} from './type_utils.ts';
export type {Gap, PatternPart, Source, Value} from './types.ts';
