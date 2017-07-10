// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {ActionTypes} from 'utils/constants.jsx';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import * as EmojiActions from 'mattermost-redux/actions/emojis';

export async function loadEmoji(getProfiles = true) {
    const data = await EmojiActions.getAllCustomEmojis()(dispatch, getState);

    if (data && getProfiles) {
        loadProfilesForEmoji(data);
    }
}

function loadProfilesForEmoji(emojiList) {
    const profilesToLoad = {};
    for (let i = 0; i < emojiList.length; i++) {
        const emoji = emojiList[i];
        if (!UserStore.hasProfile(emoji.creator_id)) {
            profilesToLoad[emoji.creator_id] = true;
        }
    }

    const list = Object.keys(profilesToLoad);
    if (list.length === 0) {
        return;
    }

    getProfilesByIds(list)(dispatch, getState);
}

export function addEmoji(emoji, image, success, error) {
    EmojiActions.createCustomEmoji(emoji, image)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.emojis.createCustomEmoji.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function deleteEmoji(emojiId, success, error) {
    EmojiActions.deleteCustomEmoji(emojiId)(dispatch, getState).then(
        (data) => {
            if (data) {
                // Needed to remove recently used emoji
                AppDispatcher.handleServerAction({
                    type: ActionTypes.REMOVED_CUSTOM_EMOJI,
                    id: emojiId
                });

                if (success) {
                    success(data);
                }
            } else if (data == null && error) {
                const serverError = getState().requests.emojis.deleteCustomEmoji.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}
