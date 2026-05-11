// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Wiki, WikiLink} from '@mattermost/types/wikis';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

type WikisState = {
    byId: Record<string, Wiki>;
    byTeam: Record<string, string[]>;
    linksByChannel: Record<string, WikiLink[]>;
};

const initialState: WikisState = {
    byId: {},
    byTeam: {},
    linksByChannel: {},
};

function mergeWiki(existing: Wiki | undefined, incoming: Wiki): Wiki {
    return existing ? {...existing, ...incoming} : incoming;
}

export default function wikisReducer(state = initialState, action: AnyAction): WikisState {
    switch (action.type) {
    case WikiTypes.RECEIVED_WIKI: {
        const wiki: Wiki = action.data;
        const updatedById = {...state.byId, [wiki.id]: mergeWiki(state.byId[wiki.id], wiki)};

        // Keep byTeam consistent when the team has already been loaded.
        // Without this, selectWikisByTeam returns stale results after a single-wiki fetch.
        let updatedByTeam = state.byTeam;
        if (wiki.team_id) {
            const existing = state.byTeam[wiki.team_id];
            if (existing && !existing.includes(wiki.id)) {
                updatedByTeam = {...state.byTeam, [wiki.team_id]: [...existing, wiki.id]};
            }
        }

        return {...state, byId: updatedById, byTeam: updatedByTeam};
    }
    case WikiTypes.RECEIVED_WIKIS: {
        const wikis: Wiki[] = action.data;
        if (!wikis || wikis.length === 0) {
            return state;
        }
        const nextById = {...state.byId};
        wikis.forEach((wiki) => {
            nextById[wiki.id] = mergeWiki(nextById[wiki.id], wiki);
        });
        return {...state, byId: nextById};
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const deletedWiki = state.byId[wikiId];
        if (!deletedWiki) {
            return state;
        }

        const nextById = {...state.byId};
        delete nextById[wikiId];

        // Remove links pointing to the deleted wiki.
        let nextLinksByChannel = state.linksByChannel;
        for (const [channelId, links] of Object.entries(state.linksByChannel)) {
            if (links.some((l) => l.wiki_id === wikiId)) {
                if (nextLinksByChannel === state.linksByChannel) {
                    nextLinksByChannel = {...state.linksByChannel};
                }
                nextLinksByChannel[channelId] = links.filter((l) => l.wiki_id !== wikiId);
            }
        }

        let nextByTeam = state.byTeam;
        for (const [teamId, wikiIds] of Object.entries(state.byTeam)) {
            if (wikiIds.includes(wikiId)) {
                if (nextByTeam === state.byTeam) {
                    nextByTeam = {...state.byTeam};
                }
                nextByTeam[teamId] = wikiIds.filter((id) => id !== wikiId);
            }
        }

        return {byId: nextById, byTeam: nextByTeam, linksByChannel: nextLinksByChannel};
    }
    case WikiTypes.RECEIVED_WIKI_LINKS: {
        const {channelId, links} = action.data as {channelId: string; links: WikiLink[]};
        return {
            ...state,
            linksByChannel: {...state.linksByChannel, [channelId]: links},
        };
    }
    case WikiTypes.RECEIVED_WIKI_LINK: {
        const {channelId, link, wikiId} = action.data as {channelId: string; link: WikiLink; wikiId: string};
        const storedLink: WikiLink = {...link, wiki_id: wikiId};
        const existingLinks = state.linksByChannel[channelId] || [];
        const alreadyExists = existingLinks.some(
            (l) => l.source_id === storedLink.source_id && l.wiki_id === wikiId,
        );
        if (alreadyExists) {
            return state;
        }
        return {
            ...state,
            linksByChannel: {...state.linksByChannel, [channelId]: [...existingLinks, storedLink]},
        };
    }
    case WikiTypes.REMOVED_WIKI_LINK: {
        const {channelId, wikiId} = action.data as {channelId: string; wikiId: string};
        const existingLinks = state.linksByChannel[channelId];
        if (!existingLinks || !existingLinks.some((l) => l.wiki_id === wikiId)) {
            return state;
        }
        return {
            ...state,
            linksByChannel: {
                ...state.linksByChannel,
                [channelId]: existingLinks.filter((l) => l.wiki_id !== wikiId),
            },
        };
    }
    case WikiTypes.RECEIVED_TEAM_WIKIS: {
        const {teamId, wikis} = action.data as {teamId: string; wikis: Wiki[]};
        const nextById = {...state.byId};
        const wikiIds: string[] = [];
        wikis.forEach((wiki) => {
            nextById[wiki.id] = mergeWiki(nextById[wiki.id], wiki);
            wikiIds.push(wiki.id);
        });
        return {
            ...state,
            byId: nextById,
            byTeam: {...state.byTeam, [teamId]: wikiIds},
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}
