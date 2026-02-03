// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CloudUsage} from '@mattermost/types/cloud';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {CloudTypes} from 'mattermost-redux/action_types';

const emptyUsage = {
    files: {
        totalStorage: 0,
        totalStorageLoaded: false,
    },
    messages: {
        history: 0,
        historyLoaded: false,
    },
    boards: {
        cards: 0,
        cardsLoaded: false,
    },
    teams: {
        active: 0,
        cloudArchived: 0,
        teamsLoaded: false,
    },
};

// represents the usage associated with this workspace
export default function usage(state: CloudUsage = emptyUsage, action: MMReduxAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_MESSAGES_USAGE: {
        return {
            ...state,
            messages: {
                history: action.data,
                historyLoaded: true,
            },
        };
    }
    case CloudTypes.RECEIVED_FILES_USAGE: {
        return {
            ...state,
            files: {
                totalStorage: action.data,
                totalStorageLoaded: true,
            },
        };
    }
    case CloudTypes.RECEIVED_BOARDS_USAGE: {
        return {
            ...state,
            boards: {
                cards: action.data,
                cardsLoaded: true,
            },
        };
    }
    case CloudTypes.RECEIVED_TEAMS_USAGE: {
        return {
            ...state,
            teams: {
                ...action.data,
                teamsLoaded: true,
            },
        };
    }
    default:
        return state;
    }
}
