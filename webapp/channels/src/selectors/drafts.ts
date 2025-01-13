// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMyActiveChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {get, onboardingTourTipsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {getGlobalItem} from 'selectors/storage';
import {getIsMobileView} from 'selectors/views/browser';

import {StoragePrefixes} from 'utils/constants';
import {getDraftInfoFromKey} from 'utils/storage_utils';

import type {GlobalState} from 'types/store';
import type {DraftInfo, PostDraft} from 'types/store/draft';

export type Draft = DraftInfo & {
    key: keyof GlobalState['storage']['storage'];
    value: PostDraft;
    timestamp: Date;
}

export type DraftSelector = (state: GlobalState) => Draft[];
export type DraftCountSelector = (state: GlobalState) => number;

export function showDraftsPulsatingDotAndTourTip(state: GlobalState): boolean {
    if (!onboardingTourTipsEnabled(state) || getIsMobileView(state)) {
        return false;
    }

    const draftsTourTipShowed = get(state, Preferences.CATEGORY_DRAFTS, Preferences.DRAFTS_TOUR_TIP_SHOWED, '');
    const draftsAlreadyViewed = draftsTourTipShowed && JSON.parse(draftsTourTipShowed)[Preferences.DRAFTS_TOUR_TIP_SHOWED];

    return !draftsAlreadyViewed;
}

export function makeGetDraftsByPrefix(prefix: string): DraftSelector {
    return createSelector(
        'makeGetDraftsByPrefix',
        (state: GlobalState) => state.storage?.storage,
        (storage) => {
            if (!storage) {
                return [];
            }

            return Object.keys(storage).flatMap((key) => {
                const item = storage[key];
                if (
                    key.startsWith(prefix) &&
                    item != null &&
                    item.value != null &&
                    (item.value.message || item.value.fileInfos?.length > 0) &&
                    item.value.show
                ) {
                    const info = getDraftInfoFromKey(key, prefix);

                    if (info === null || !info.id) {
                        return [];
                    }

                    return {
                        ...item,
                        key,
                        id: info.id,
                        type: info.type,
                    };
                }
                return [];
            });
        },
    );
}

const getChannelDrafts = makeGetDraftsByPrefix(StoragePrefixes.DRAFT);
const getRHSDrafts = makeGetDraftsByPrefix(StoragePrefixes.COMMENT_DRAFT);

/**
 * Gets all local drafts in storage.
 * @param excludeInactive determines if we filter drafts based on active channels.
 */
export function makeGetDrafts(excludeInactive = true): DraftSelector {
    return createSelector(
        'makeGetDrafts',
        getChannelDrafts,
        getRHSDrafts,
        getMyActiveChannelIds,
        (channelDrafts, rhsDrafts, myChannels) => (
            [...channelDrafts, ...rhsDrafts]
        ).
            filter((draft) => (excludeInactive ? myChannels.indexOf(draft.value.channelId) !== -1 : true)).
            sort((a, b) => b.value.updateAt - a.value.updateAt),
    );
}

export function makeGetDraftsCount(): DraftCountSelector {
    return createSelector(
        'makeGetDraftsCount',
        getChannelDrafts,
        getRHSDrafts,
        getMyActiveChannelIds,
        (channelDrafts, rhsDrafts, myChannels) => [...channelDrafts, ...rhsDrafts].
            filter((draft) => myChannels.indexOf(draft.value.channelId) !== -1).length,
    );
}

export function makeGetDraft() {
    const DEFAULT_DRAFT = Object.freeze({
        message: '',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: '',
        rootId: '',
    });

    return createSelector(
        'makeGetDraft',
        (_: GlobalState, channelId: string) => channelId,
        (_: GlobalState, channelId: string, rootId = '') => rootId,
        (state: GlobalState, channelId: string, rootId = '', storageKey = '') => {
            let prefixStorageKey = StoragePrefixes.DRAFT;
            let suffixStorageKey = channelId;
            if (rootId) {
                prefixStorageKey = StoragePrefixes.COMMENT_DRAFT;
                suffixStorageKey = rootId;
            }
            const key = storageKey || `${prefixStorageKey}${suffixStorageKey}`;

            return getGlobalItem<PostDraft>(state, key, DEFAULT_DRAFT);
        },
        (channelId, rootId, retrievedDraftParam) => {
            let retrievedDraft = retrievedDraftParam;
            if (retrievedDraft.metadata?.files) {
                retrievedDraft = {...retrievedDraft, fileInfos: retrievedDraft.metadata.files};
            }

            // Check if the draft has the required values in its properties
            const isDraftWithRequiredValues = typeof retrievedDraft.message !== 'undefined' && typeof retrievedDraft.uploadsInProgress !== 'undefined' && typeof retrievedDraft.fileInfos !== 'undefined';

            // Check if draft's channelId or rootId mismatches with the passed one
            const isDraftMismatched = retrievedDraft.channelId !== channelId || retrievedDraft.rootId !== rootId;

            if (isDraftWithRequiredValues && !isDraftMismatched) {
                return retrievedDraft;
            }

            return {
                ...DEFAULT_DRAFT,
                ...retrievedDraft,
                channelId,
                rootId,
            };
        },
    );
}
