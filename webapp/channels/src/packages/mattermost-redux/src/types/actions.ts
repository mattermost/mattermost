// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Action as ReduxAction, AnyAction} from 'redux';
import type {ThunkAction as BaseThunkAction} from 'redux-thunk';

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

export type DispatchFunc = (action: AnyAction | NewActionFunc<unknown, any> | NewActionFuncAsync<unknown, any> | ThunkActionFunc<any>, getState?: GetStateFunc | null) => Promise<ActionResult>;

/**
 * NewActionFunc should be the return type of most non-async Thunk action creators. If that action requires web app
 * state, the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type NewActionFunc<Data = unknown, State extends GlobalState = GlobalState> = BaseThunkAction<ActionResult<Data>, State, unknown, ReduxAction>;

/**
 * NewActionFunc should be the return type of most async Thunk action creators. If that action requires web app
 * state, the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type NewActionFuncAsync<Data = unknown, State extends GlobalState = GlobalState> = BaseThunkAction<Promise<ActionResult<Data>>, State, unknown, ReduxAction>;

/**
 * ThunkActionFunc is a type that extends ActionFunc with defaults that match our other ActionFunc variants to save
 * users from having to manually specify GlobalState and other arguments.
 *
 * NewActionFunc or NewActionFuncAsync should generally be preferred, but this type is available for legacy code.
 */
export type ThunkActionFunc<ReturnType, State extends GlobalState = GlobalState> = BaseThunkAction<ReturnType, State, unknown, AnyAction>;
