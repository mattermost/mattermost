// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {ActionTypes} from 'utils/constants.jsx';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {getProfilesByIds} from 'mattermost-redux/actions/users';

export function loadEmoji(getProfiles = true) {
    Client.listEmoji(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CUSTOM_EMOJIS,
                emojis: data
            });

            if (getProfiles) {
                loadProfilesForEmoji(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'listEmoji');
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
