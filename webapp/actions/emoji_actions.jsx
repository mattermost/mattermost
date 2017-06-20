// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {getAllCustomEmojis} from 'mattermost-redux/actions/emojis';

export function loadEmoji(getProfiles = true) {
    getAllCustomEmojis(10000)(dispatch, getState).then(
        (data) => {
            if (getProfiles) {
                loadProfilesForEmoji(data);
            }
        }
    );
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
