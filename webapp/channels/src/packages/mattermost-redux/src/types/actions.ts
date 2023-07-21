// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {AnyAction} from 'redux';
import {BatchAction} from 'redux-batched-actions';

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
