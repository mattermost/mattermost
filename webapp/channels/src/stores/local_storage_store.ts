// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';

import {getBasePath} from 'selectors/general';
import store from 'stores/redux_store';

import {PreviousViewedTypes} from 'utils/constants';

const getPreviousTeamIdKey = (userId: string) => ['user_prev_team', userId].join(':');
const getPreviousChannelNameKey = (userId: string | null, teamId: string) => ['user_team_prev_channel', userId, teamId].join(':');
const getPreviousViewedTypeKey = (userId: string | null, teamId: string) => ['user_team_prev_viewed_type', userId, teamId].join(':');
const getPenultimateViewedTypeKey = (userId: string, teamId: string) => ['user_team_penultimate_viewed_type', userId, teamId].join(':');
export const getPenultimateChannelNameKey = (userId: string, teamId: string) => ['user_team_penultimate_channel', userId, teamId].join(':');
const getRecentEmojisKey = (userId: string) => ['recent_emojis', userId].join(':');
const getWasLoggedInKey = () => 'was_logged_in';
const teamIdJoinedOnLoadKey = 'teamIdJoinedOnLoad';
const wasNotifiedOfLogInKey = 'was_notified_of_login';

const getPathScopedKey = (path: string, key: string) => {
    if (path === '' || path === '/') {
        return key;
    }

    return [path, key].join(':');
};

// LocalStorageStore exposes an interface for accessing entries in the localStorage.
//
// Note that this excludes keys managed by redux-persist. The latter cannot currently be used for
// key/value storage that persists beyond logout. Ideally, we could purge all but certain parts
// of the Redux store so as to allow them to be used on re-login.

// Lets open a separate issue to refactor local storage and state interactions.
// This whole store can be connected to redux
class LocalStorageStoreClass {
    getItem(key: string, state = store.getState()) {
        const basePath = getBasePath(state);

        return localStorage.getItem(getPathScopedKey(basePath, key));
    }

    setItem(key: string, value: string | null) {
        const state = store.getState();
        const basePath = getBasePath(state);

        localStorage.setItem(getPathScopedKey(basePath, key), value === null ? 'null' : value);
    }

    getPreviousChannelName(userId: string | null, teamId: string, state = store.getState()) {
        return this.getItem(getPreviousChannelNameKey(userId, teamId), state) || getRedirectChannelNameForTeam(state, teamId);
    }

    getPreviousViewedType(userId: string | null, teamId: string, state = store.getState()) {
        return this.getItem(getPreviousViewedTypeKey(userId, teamId), state) ?? PreviousViewedTypes.CHANNELS;
    }

    removeItem(key: string) {
        const state = store.getState();
        const basePath = getBasePath(state);

        localStorage.removeItem(getPathScopedKey(basePath, key));
    }

    setPreviousChannelName(userId: string, teamId: string, channelName: string) {
        this.setItem(getPreviousChannelNameKey(userId, teamId), channelName);
    }

    setPreviousViewedType(userId: string, teamId: string, channelType: string) {
        this.setItem(getPreviousViewedTypeKey(userId, teamId), channelType);
    }

    getPenultimateViewedType(userId: string, teamId: string, state = store.getState()) {
        return this.getItem(getPenultimateViewedTypeKey(userId, teamId), state) ?? PreviousViewedTypes.CHANNELS;
    }

    setPenultimateViewedType(userId: string, teamId: string, channelType: string) {
        this.setItem(getPenultimateViewedTypeKey(userId, teamId), channelType);
    }
    getPenultimateChannelName(userId: string, teamId: string, state = store.getState()) {
        return this.getItem(getPenultimateChannelNameKey(userId, teamId), state) || getRedirectChannelNameForTeam(state, teamId);
    }

    setPenultimateChannelName(userId: string, teamId: string, channelName: string) {
        this.setItem(getPenultimateChannelNameKey(userId, teamId), channelName);
    }

    removePreviousChannelName(userId: string, teamId: string, state = store.getState()) {
        this.setItem(getPreviousChannelNameKey(userId, teamId), this.getPenultimateChannelName(userId, teamId, state));
        this.removeItem(getPenultimateChannelNameKey(userId, teamId));
    }

    removePreviousChannelType(userId: string, teamId: string, state = store.getStore()) {
        this.setItem(getPreviousViewedTypeKey(userId, teamId), this.getPenultimateViewedType(userId, teamId, state));
        this.removeItem(getPenultimateViewedTypeKey(userId, teamId));
    }

    removePreviousChannel(userId: string, teamId: string, state = store.getStore()) {
        this.removePreviousChannelName(userId, teamId, state);
        this.removePreviousChannelType(userId, teamId, state);
    }

    removePenultimateChannelName(userId: string, teamId: string) {
        this.removeItem(getPenultimateChannelNameKey(userId, teamId));
    }

    removePenultimateViewedType(userId: string, teamId: string) {
        this.removeItem(getPenultimateViewedTypeKey(userId, teamId));
    }

    getPreviousTeamId(userId: string) {
        return this.getItem(getPreviousTeamIdKey(userId));
    }

    setPreviousTeamId(userId: string, teamId: string) {
        this.setItem(getPreviousTeamIdKey(userId), teamId);
    }

    /**
     * Returns the list of recently used emojis for the user in string format.
     * @param {string} userId The user ID.
     * @returns The list of emojis in string format. eg. '['smile','+1', 'pizza']'
     * @memberof LocalStorageStore
     * @example
     * const recentEmojis = LocalStorageStore.getRecentEmojis('userId');
     * if (recentEmojis) {
     *  const recentEmojisArray = JSON.parse(recentEmojis);
     * // do something with the emoji list
     * }
     **/
    getRecentEmojis(userId: string) {
        const recentEmojis = this.getItem(getRecentEmojisKey(userId));
        if (!recentEmojis) {
            return null;
        }

        return recentEmojis;
    }

    getTeamIdJoinedOnLoad() {
        return this.getItem(teamIdJoinedOnLoadKey);
    }

    setTeamIdJoinedOnLoad(teamId: string | null) {
        this.setItem(teamIdJoinedOnLoadKey, teamId);
    }

    setWasLoggedIn(wasLoggedIn: boolean) {
        if (wasLoggedIn) {
            this.setItem(getWasLoggedInKey(), 'true');
        } else {
            this.setItem(getWasLoggedInKey(), 'false');
        }
    }

    getWasLoggedIn() {
        return this.getItem(getWasLoggedInKey()) === 'true';
    }

    // the following flag's setter and getter are used to make sure a user is notified (via aria-label)
    // about a successful login only once (MM-50821)
    setWasNotifiedOfLogIn(wasNotified: boolean) {
        this.setItem(wasNotifiedOfLogInKey, String(wasNotified));
    }

    getWasNotifiedOfLogIn() {
        return this.getItem(wasNotifiedOfLogInKey) === 'true';
    }
}

const LocalStorageStore = new LocalStorageStoreClass();

export default LocalStorageStore;
