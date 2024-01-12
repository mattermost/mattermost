// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Action, AnyAction} from 'redux';
import type {ThunkAction, ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

/**
 * This file extends Redux's Dispatch type and bindActionCreators function to support Thunk actions by default.
 *
 * It specifically requires those action creators to return ThunkAction-derived types which are not compatible with
 * our existing ActionFunc and Thunk types, and it requires NewActionFunc*
 */
import 'redux-thunk/extend-redux';

export type GetStateFunc = () => GlobalState;
export type GenericAction = AnyAction;

/**
 * ActionResult should be the return value of most Thunk action creators.
 */
export type ActionResult<Data = any, Error = any> = {
    data?: Data;
    error?: Error;
};

export type DispatchFunc<State extends GlobalState = GlobalState> = ThunkDispatch<State, unknown, Action>;

/**
 * NewActionFunc should be the return type of most non-async Thunk action creators. If that action requires web app
 * state, the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type NewActionFunc<Data = unknown, State extends GlobalState = GlobalState> = ThunkAction<ActionResult<Data>, State, unknown, Action>;

/**
 * NewActionFunc should be the return type of most async Thunk action creators. If that action requires web app
 * state, the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type NewActionFuncAsync<Data = unknown, State extends GlobalState = GlobalState> = ThunkAction<Promise<ActionResult<Data>>, State, unknown, Action>;

/**
 * NewActionFuncOldVariantDoNotUse is a (hopefully) temporary type to let us migrate actions which previously returned
 * an array of promises to use a ThunkAction without having to modify their logic yet.
 */
export type NewActionFuncOldVariantDoNotUse<Data = unknown, State extends GlobalState = GlobalState> = ThunkAction<Data, State, unknown, Action>;
