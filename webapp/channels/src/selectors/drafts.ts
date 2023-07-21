// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMyActiveChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {get, onboardingTourTipsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';
import {DraftInfo, PostDraft} from 'types/store/draft';
import {StoragePrefixes} from 'utils/constants';
import {getDraftInfoFromKey} from 'utils/storage_utils';

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

/**
 * Gets all local drafts in storage.
 * @param excludeInactive determines if we filter drafts based on active channels.
 */
export function makeGetDrafts(excludeInactive = true): DraftSelector {
    const getChannelDrafts = makeGetDraftsByPrefix(StoragePrefixes.DRAFT);
    const getRHSDrafts = makeGetDraftsByPrefix(StoragePrefixes.COMMENT_DRAFT);

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
    const getChannelDrafts = makeGetDraftsByPrefix(StoragePrefixes.DRAFT);
    const getRHSDrafts = makeGetDraftsByPrefix(StoragePrefixes.COMMENT_DRAFT);
    return createSelector(
        'makeGetDraftsCount',
        getChannelDrafts,
        getRHSDrafts,
        getMyActiveChannelIds,
        (channelDrafts, rhsDrafts, myChannels) => [...channelDrafts, ...rhsDrafts].
            filter((draft) => myChannels.indexOf(draft.value.channelId) !== -1).length,
    );
}
