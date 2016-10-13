// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import Client from 'client/web_client.jsx';

import {ActionTypes, Preferences, Constants} from 'utils/constants.jsx';

export function loadStatusesForChannel(channelId = ChannelStore.getCurrentId()) {
    const postList = PostStore.getVisiblePosts(channelId);
    if (!postList || !postList.posts) {
        return;
    }

    const statusesToLoad = {};
    for (const pid in postList.posts) {
        if (!postList.posts.hasOwnProperty(pid)) {
            continue;
        }

        const post = postList.posts[pid];
        statusesToLoad[post.user_id] = true;
    }

    loadStatusesByIds(Object.keys(statusesToLoad));
}

export function loadStatusesForDMSidebar() {
    const dmPrefs = PreferenceStore.getCategory(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);
    const statusesToLoad = [];

    for (const [key, value] of dmPrefs) {
        if (value === 'true') {
            statusesToLoad.push(key);
        }
    }

    loadStatusesByIds(statusesToLoad);
}

export function loadStatusesForChannelAndSidebar() {
    const statusesToLoad = {};

    const channelId = ChannelStore.getCurrentId();
    const postList = PostStore.getVisiblePosts(channelId);
    if (postList && postList.posts) {
        for (const pid in postList.posts) {
            if (!postList.posts.hasOwnProperty(pid)) {
                continue;
            }

            const post = postList.posts[pid];
            statusesToLoad[post.user_id] = true;
        }
    }

    const dmPrefs = PreferenceStore.getCategory(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);

    for (const [key, value] of dmPrefs) {
        if (value === 'true') {
            statusesToLoad[key] = true;
        }
    }

    loadStatusesByIds(Object.keys(statusesToLoad));
}

export function loadStatusesForProfilesList(users) {
    if (users == null) {
        return;
    }

    const statusesToLoad = [];
    for (let i = 0; i < users.length; i++) {
        statusesToLoad.push(users[i].id);
    }

    loadStatusesByIds(statusesToLoad);
}

export function loadStatusesForProfilesMap(users) {
    if (users == null) {
        return;
    }

    const statusesToLoad = [];
    for (const userId in users) {
        if (!users.hasOwnProperty(userId)) {
            return;
        }
        statusesToLoad.push(userId);
    }

    loadStatusesByIds(statusesToLoad);
}

export function loadStatusesByIds(userIds) {
    if (userIds.length === 0) {
        return;
    }

    Client.getStatusesByIds(
        userIds,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_STATUSES,
                statuses: data
            });
        }
    );
}

let intervalId = '';

export function startPeriodicStatusUpdates() {
    clearInterval(intervalId);

    intervalId = setInterval(
        () => {
            loadStatusesForChannelAndSidebar();
        },
        Constants.STATUS_INTERVAL
    );
}

export function stopPeriodicStatusUpdates() {
    clearInterval(intervalId);
}
