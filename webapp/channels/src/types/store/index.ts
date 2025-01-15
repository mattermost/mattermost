// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RehydrateAction} from 'redux-persist';

import type {GlobalState as BaseGlobalState} from '@mattermost/types/store';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import type {AnyActionFrom, AnyActionWithType} from 'mattermost-redux/action_types/types';
import type {WebsocketEvents} from 'mattermost-redux/constants';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type * as MMReduxTypes from 'mattermost-redux/types/actions';

import type {StorageAction} from 'actions/storage';
import type {ThreadAction} from 'actions/views/threads';

import type {ActionTypes, SearchTypes} from 'utils/constants';

import type {PluginsState} from './plugins';
import type {StorageState} from './storage';
import type {ViewsState} from './views';

export type DraggingState = {
    state?: string;
    type?: string;
    id?: string;
}

export type GlobalState = BaseGlobalState & {
    plugins: PluginsState;
    storage: StorageState;
    views: ViewsState;
};

/**
 * An MMAction is any non-Thunk Redux action accepted by the web app and mattermost-redux.
 */
export type MMAction = (

    // Actions used by mattermost-redux reducers
    MMReduxAction |

    // Actions used by web app reducers
    AnyActionFrom<typeof ActionTypes & typeof SearchTypes> |
    ThreadAction |
    StorageAction |

    // Actions used by the reducer for state.entities.typing in mattermost-redux which are incorrectly reusing WS
    // message types
    AnyActionWithType<typeof WebsocketEvents.TYPING | typeof WebsocketEvents.STOP_TYPING> |

    // An action used by redux-persist on initial load and when state.storage is changed from another tab
    RehydrateAction
);

/**
 * A version of {@link MMReduxTypes.DispatchFunc} which supports dispatching web app actions.
 */
export type DispatchFunc = MMReduxTypes.DispatchFunc<MMAction>;

/**
 * A version of {@link MMReduxTypes.GetStateFunc} which supports web app state.
 */
export type GetStateFunc<State extends GlobalState = GlobalState> = MMReduxTypes.GetStateFunc<State>;

/**
 * A version of {@link MMReduxTypes.ActionFunc} which supports web app state and allows dispatching its actions.
 */
export type ActionFunc<
    Data = unknown,
    State extends GlobalState = GlobalState,
> = MMReduxTypes.ActionFunc<Data, State, MMAction>;

/**
 * A version of {@link MMReduxTypes.ActionFuncAsync} which supports web app state and allows dispatching its actions.
 */
export type ActionFuncAsync<
    Data = unknown,
    State extends GlobalState = GlobalState,
> = MMReduxTypes.ActionFuncAsync<Data, State, MMAction>;

/**
 * A version of {@link MMReduxTypes.ThunkActionFunc} which supports web app state and allows dispatching its actions.
 */
export type ThunkActionFunc<
    ReturnType,
    State extends GlobalState = GlobalState
> = MMReduxTypes.ThunkActionFunc<ReturnType, State, MMAction>;
