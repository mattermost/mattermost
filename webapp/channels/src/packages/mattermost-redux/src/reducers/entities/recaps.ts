// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Recap} from '@mattermost/types/recaps';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {RecapTypes, UserTypes} from 'mattermost-redux/action_types';

export type RecapsState = {
    byId: Record<string, Recap>;
    allIds: string[];
};

const initialState: RecapsState = {
    byId: {},
    allIds: [],
};

export default function recapsReducer(state = initialState, action: MMReduxAction): RecapsState {
    switch (action.type) {
    case RecapTypes.RECEIVED_RECAP: {
        const recap = action.data as Recap;
        const nextState = {...state};
        nextState.byId = {
            ...state.byId,
            [recap.id]: recap,
        };
        if (!state.allIds.includes(recap.id)) {
            nextState.allIds = [...state.allIds, recap.id];
        }
        return nextState;
    }

    case RecapTypes.RECEIVED_RECAPS: {
        const recaps = action.data as Recap[];
        const nextState = {...state};
        const newById: Record<string, Recap> = {...state.byId};
        const newAllIds = new Set(state.allIds);

        recaps.forEach((recap) => {
            newById[recap.id] = recap;
            newAllIds.add(recap.id);
        });

        nextState.byId = newById;
        nextState.allIds = Array.from(newAllIds);
        return nextState;
    }

    case RecapTypes.DELETE_RECAP_SUCCESS: {
        const {recapId} = action.data as {recapId: string};
        const nextState = {...state};
        const newById = {...state.byId};
        delete newById[recapId];

        nextState.byId = newById;
        nextState.allIds = state.allIds.filter((id) => id !== recapId);
        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialState;

    default:
        return state;
    }
}

