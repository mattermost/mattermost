// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Draft as ServerDraft} from '@mattermost/types/drafts';
import type {FileInfo} from '@mattermost/types/files';
import type {PostMetadata, PostPriorityMetadata} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {getPost} from 'mattermost-redux/actions/posts';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';
import Preferences from 'mattermost-redux/constants/preferences';
import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';

import {removeGlobalItem, setGlobalItem} from 'actions/storage';
import {makeGetDrafts} from 'selectors/drafts';
import {getConnectionId} from 'selectors/general';
import {getGlobalItem} from 'selectors/storage';

import {ActionTypes, StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type Draft = {
    key: keyof GlobalState['storage']['storage'];
    value: PostDraft;
    timestamp: Date;
}

/**
 * Gets drafts stored on the server and reconciles them with any locally stored drafts.
 * @param teamId Only drafts for the given teamId will be fetched.
 */
export function getDrafts(teamId: string): ActionFuncAsync<boolean, GlobalState> {
    const getLocalDrafts = makeGetDrafts(false);

    return async (dispatch, getState) => {
        const state = getState();

        let serverDrafts: Draft[] = [];
        try {
            const response = await Client4.getUserDrafts(teamId);

            // check if response is an array
            if (Array.isArray(response)) {
                serverDrafts = response.map((draft) => transformServerDraft(draft));
            }
        } catch (error) {
            return {data: false, error};
        }

        const drafts = [...serverDrafts];
        const localDrafts = getLocalDrafts(state);

        // drafts that are not on server, but on local storage
        const localOnlyDrafts = localDrafts.filter((localDraft) => {
            return !serverDrafts.find((serverDraft) => serverDraft.key === localDraft.key);
        });

        // check if drafts are still valid
        await Promise.all(localOnlyDrafts.map(async (draft) => {
            if (draft.value.rootId) {
                // get post from server to check if it exists
                const {error} = await dispatch(getPost(draft.value.rootId));

                // remove locally stored draft if post does not exist
                if (error.status_code === 404) {
                    await dispatch(setGlobalItem(draft.key, {message: '', fileInfos: [], uploadsInProgress: []}));
                    await dispatch(removeGlobalItem(draft.key));
                    return;
                }
            }

            drafts.push(draft);
        }));

        // Reconcile drafts and only keep the latest version of a draft.
        const draftsMap = new Map(drafts.map((draft) => [draft.key, draft]));
        drafts.forEach((draft) => {
            const currentDraft = draftsMap.get(draft.key);
            if (currentDraft && draft.timestamp > currentDraft.timestamp) {
                draftsMap.set(draft.key, draft);
            }
        });

        const actions = Array.from(draftsMap).map(([key, draft]) => {
            return setGlobalItem(key, draft.value);
        });

        dispatch(batchActions(actions));
        return {data: true};
    };
}

export function removeDraft(key: string, channelId: string, rootId = ''): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();

        // set draft to empty to re-render the component
        await dispatch(setGlobalItem(key, {message: '', fileInfos: [], uploadsInProgress: []}));

        // remove draft from storage
        await dispatch(removeGlobalItem(key));

        if (syncedDraftsAreAllowedAndEnabled(state)) {
            const connectionId = getConnectionId(getState());

            try {
                await Client4.deleteDraft(channelId, rootId, connectionId);
            } catch (error) {
                return {
                    data: false,
                    error,
                };
            }
        }
        return {data: true};
    };
}

export function updateDraft(key: string, value: PostDraft|null, rootId = '', save = false): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        let updatedValue: PostDraft|null = null;
        if (value) {
            const timestamp = new Date().getTime();
            const data = getGlobalItem(state, key, {});
            updatedValue = {
                ...value,
                createAt: data.createAt || timestamp,
                updateAt: timestamp,
            };
        }

        dispatch(setGlobalDraft(key, updatedValue, false));

        if (syncedDraftsAreAllowedAndEnabled(state) && save && updatedValue) {
            const connectionId = getConnectionId(state);
            const userId = getCurrentUserId(state);
            try {
                await upsertDraft(updatedValue, userId, rootId, connectionId);
            } catch (error) {
                return {data: false, error};
            }
        }
        return {data: true};
    };
}

function upsertDraft(draft: PostDraft, userId: UserProfile['id'], rootId = '', connectionId: string) {
    const fileIds = draft.fileInfos.map((file) => file.id);
    const newDraft = {
        create_at: draft.createAt || 0,
        update_at: draft.updateAt || 0,
        delete_at: 0,
        user_id: userId,
        channel_id: draft.channelId,
        root_id: draft.rootId || rootId,
        message: draft.message,
        props: draft.props,
        file_ids: fileIds,
        priority: draft.metadata?.priority as PostPriorityMetadata,
    };

    return Client4.upsertDraft(newDraft, connectionId);
}

export function setDraftsTourTipPreference(initializationState: Record<string, boolean>): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_DRAFTS,
            name: Preferences.DRAFTS_TOUR_TIP_SHOWED,
            value: JSON.stringify(initializationState),
        };
        await dispatch(savePreferences(currentUserId, [preference]));
        return {data: true};
    };
}

export function setGlobalDraft(key: string, value: PostDraft|null, isRemote: boolean): ActionFunc {
    return (dispatch) => {
        dispatch(setGlobalItem(key, value));
        dispatch(setGlobalDraftSource(key, isRemote));
        return {data: true};
    };
}

export function setGlobalDraftSource(key: string, isRemote: boolean) {
    return {
        type: ActionTypes.SET_DRAFT_SOURCE,
        data: {
            key,
            isRemote,
        },
    };
}

export function transformServerDraft(draft: ServerDraft): Draft {
    let key: Draft['key'] = `${StoragePrefixes.DRAFT}${draft.channel_id}`;

    if (draft.root_id !== '') {
        key = `${StoragePrefixes.COMMENT_DRAFT}${draft.root_id}`;
    }

    let fileInfos: FileInfo[] = [];
    if (draft.metadata?.files) {
        fileInfos = draft.metadata.files;
    }

    const metadata = (draft.metadata || {}) as PostMetadata;
    if (draft.priority) {
        metadata.priority = draft.priority;
    }

    return {
        key,
        timestamp: new Date(draft.update_at),
        value: {
            message: draft.message,
            fileInfos,
            props: draft.props,
            uploadsInProgress: [],
            channelId: draft.channel_id,
            rootId: draft.root_id,
            createAt: draft.create_at,
            updateAt: draft.update_at,
            metadata,
            show: true,
        },
    };
}
