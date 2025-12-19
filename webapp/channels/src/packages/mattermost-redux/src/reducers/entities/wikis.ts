// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Wiki} from '@mattermost/types/wikis';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

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
        const existingWiki = state.byId[wiki.id];

        const nextByChannel = {...state.byChannel};

        // If wiki existed in a different channel, remove it from old channel
        if (existingWiki && existingWiki.channel_id !== wiki.channel_id) {
            const oldChannelWikis = nextByChannel[existingWiki.channel_id] || [];
            nextByChannel[existingWiki.channel_id] = oldChannelWikis.filter((id) => id !== wiki.id);
        }

        // Add wiki to new channel if not already there
        const currentWikiIds = nextByChannel[wiki.channel_id] || [];
        const nextWikiIds = currentWikiIds.includes(wiki.id) ? currentWikiIds : [...currentWikiIds, wiki.id];
        nextByChannel[wiki.channel_id] = nextWikiIds;

        // Merge with existing wiki data to preserve fields not included in partial updates
        // (e.g., websocket events may only include updated fields)
        const mergedWiki = existingWiki ? {...existingWiki, ...wiki} : wiki;

        return {
            ...state,
            byChannel: nextByChannel,
            byId: {
                ...state.byId,
                [wiki.id]: mergedWiki,
            },
        };
    }
    case WikiTypes.RECEIVED_WIKIS: {
        const wikis: Wiki[] = action.data;
        if (!wikis || wikis.length === 0) {
            return state;
        }

        const nextByChannel = {...state.byChannel};
        const nextById = {...state.byId};

        wikis.forEach((wiki) => {
            const existingWiki = nextById[wiki.id];

            // If wiki existed in a different channel, remove it from old channel
            if (existingWiki && existingWiki.channel_id !== wiki.channel_id) {
                const oldChannelWikis = nextByChannel[existingWiki.channel_id] || [];
                nextByChannel[existingWiki.channel_id] = oldChannelWikis.filter((id) => id !== wiki.id);
            }

            // Add wiki to new channel if not already there
            const currentWikiIds = nextByChannel[wiki.channel_id] || [];
            if (!currentWikiIds.includes(wiki.id)) {
                nextByChannel[wiki.channel_id] = [...currentWikiIds, wiki.id];
            }

            // Merge with existing wiki data to preserve fields not included in partial updates
            nextById[wiki.id] = existingWiki ? {...existingWiki, ...wiki} : wiki;
        });

        return {
            ...state,
            byChannel: nextByChannel,
            byId: nextById,
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
    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}
