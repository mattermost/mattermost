// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Typing} from '@mattermost/types/typing';

import {WebsocketEvents} from 'mattermost-redux/constants';

export default function typing(state: Typing = {}, action: AnyAction): Typing {
    const {
        data,
        type,
    } = action;

    switch (type) {
    case WebsocketEvents.TYPING: {
        const {
            id,
            userId,
            now,
        } = data;

        if (id && userId) {
            return {
                ...state,
                [id]: {
                    ...(state[id] || {}),
                    [userId]: now,
                },
            };
        }

        return state;
    }
    case WebsocketEvents.STOP_TYPING: {
        const {
            id,
            userId,
            now,
        } = data;

        if (state[id] && state[id][userId] <= now) {
            const nextState: Typing = {
                ...state,
                [id]: {...state[id]},
            };

            Reflect.deleteProperty(nextState[id], userId);

            if (Object.keys(nextState[id]).length === 0) {
                Reflect.deleteProperty(nextState, id);
            }

            return nextState;
        }

        return state;
    }

    default:
        return state;
    }
}
