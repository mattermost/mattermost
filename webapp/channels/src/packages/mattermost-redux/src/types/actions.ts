// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Action, Dispatch} from 'redux';
import type {ThunkAction} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import type {MMReduxAction} from 'mattermost-redux/action_types';

/**
 * This file extends Redux's Dispatch type and bindActionCreators function to support Thunk actions by default.
 *
 * It specifically requires those action creators to return ThunkAction-derived types.
 */
import 'redux-thunk/extend-redux';

export type DispatchFunc<TAction extends Action = MMReduxAction> = Dispatch<TAction>;
export type GetStateFunc<State = GlobalState> = () => State;

/**
 * ActionResult should be the return value of most Thunk action creators.
 */
export type ActionResult<Data = any, Error = any> = {
    data?: Data;
    error?: Error;
};

/**
 * ActionFunc should be the return type of most non-async Thunk action creators. If that action requires web app state,
 * the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type ActionFunc<
    Data = unknown,
    State extends GlobalState = GlobalState,
    TAction extends Action = MMReduxAction
> = ThunkAction<ActionResult<Data>, State, unknown, TAction>;

/**
 * ActionFuncAsync should be the return type of most async Thunk action creators. If that action requires web app state,
 * the second type parameter should be used to pass the version of GlobalState from 'types/store'.
 */
export type ActionFuncAsync<
    Data = unknown,
    State extends GlobalState = GlobalState,
    TAction extends Action = MMReduxAction
> = ThunkAction<Promise<ActionResult<Data>>, State, unknown, TAction>;

/**
 * ThunkActionFunc is a type that extends ActionFunc with defaults that match our other ActionFunc variants to save
 * users from having to manually specify GlobalState and other arguments.
 *
 * ActionFunc or ActionFuncAsync should generally be preferred, but this type is available for legacy code.
 */
export type ThunkActionFunc<
    ReturnType,
    State extends GlobalState = GlobalState,
    TAction extends Action = MMReduxAction
> = ThunkAction<ReturnType, State, unknown, TAction>;
