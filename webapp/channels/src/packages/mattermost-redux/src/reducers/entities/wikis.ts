// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Wiki} from '@mattermost/types/wikis';

import {WikiTypes} from 'mattermost-redux/action_types';

type WikisState = {
    byChannel: Record<string, string[]>;
    byId: Record<string, Wiki>;
};

const initialState: WikisState = {
    byChannel: {},
    byId: {},
};

export default function wikisReducer(state = initialState, action: AnyAction): WikisState {
    switch (action.type) {
    case WikiTypes.RECEIVED_WIKI: {
        const wiki: Wiki = action.data;

        const currentWikiIds = state.byChannel[wiki.channel_id] || [];
        const nextWikiIds = currentWikiIds.includes(wiki.id) ? currentWikiIds : [...currentWikiIds, wiki.id];

        return {
            ...state,
            byChannel: {
                ...state.byChannel,
                [wiki.channel_id]: nextWikiIds,
            },
            byId: {
                ...state.byId,
                [wiki.id]: wiki,
            },
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const deletedWiki = state.byId[wikiId];

        if (!deletedWiki) {
            return state;
        }

        const nextByChannel = {...state.byChannel};
        if (nextByChannel[deletedWiki.channel_id]) {
            nextByChannel[deletedWiki.channel_id] = nextByChannel[deletedWiki.channel_id].filter((id) => id !== wikiId);
        }

        const nextById = {...state.byId};
        delete nextById[wikiId];

        return {
            ...state,
            byChannel: nextByChannel,
            byId: nextById,
        };
    }
    default:
        return state;
    }
}
