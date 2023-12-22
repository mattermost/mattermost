// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import type {BatchAction} from 'redux-batched-actions';

import type {GlobalState} from '@mattermost/types/store';

export type GetStateFunc = () => GlobalState;
export type GenericAction = AnyAction;
export type Thunk = (b: DispatchFunc, a: GetStateFunc) => Promise<ActionResult> | ActionResult;

export type Action = GenericAction | Thunk | BatchAction | ActionFunc;

export type ActionResult<Data = any, Error = any> = {
    data?: Data;
    error?: Error;
};

export type DispatchFunc = (action: Action, getState?: GetStateFunc | null) => Promise<ActionResult>;

/**
 * Return type of a redux action.
 * @usage
 * ActionFunc<ReturnTypeOfData, ErrorType>
 */
export type ActionFunc<Data = any, Error = any> = (
    dispatch: DispatchFunc,
    getState: GetStateFunc
) => Promise<ActionResult<Data, Error> | Array<ActionResult<Data, Error>>> | ActionResult<Data, Error>;
