// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ValueOf} from '@mattermost/types/utilities';

/**
 * AnyActionWithType is a version of Redux's AnyAction where the type field has a constant type.
 */
export type AnyActionWithType<T> = {
    type: T;
    [extraProps: string]: any;
};

/**
 * AnyActionFrom constructs a union type where actions of all given types are turned into AnyActions. This ensures that
 * code which uses the resulting action has a valid type.
 *
 * @param AllActions - The type of an object where each key is an action type such as `typeof ATypes & typeof BTypes`
 */
export type AnyActionFrom<AllActions extends Record<string, unknown>> = AnyActionWithType<keyof AllActions>;

type SomeActionsMap<
    AllActions extends Record<string, unknown>,
    DefinedActions extends Record<string, Record<string, unknown>>
> = {

    // If this ActionType has a type defined in DefinedActions
    [ActionType in keyof AllActions]: ActionType extends keyof DefinedActions ?

        // Use that type
        DefinedActions[ActionType] :

        // Otherwise, make this an AnyAction
        AnyActionWithType<ActionType>;
};

/**
 * SomeAction is used to construct a union type which can represent a number of well-typed Redux actions while treating
 * all other actions as if they were AnyActions. This lets us gradually add type definitions to Redux actions
 * throughout the app without requiring types for all existing actions.
 *
 * @param AllActions - The type of an object where each key is an action type such as `typeof UserTypes`
 * @param DefinedActions - A type which maps keys of AllActions to a concrete definition for that action type
 */
export type SomeAction<
    AllActions extends Record<string, unknown>,
    DefinedActions extends Record<string, Record<string, unknown>>
> = ValueOf<SomeActionsMap<AllActions, DefinedActions>>;

