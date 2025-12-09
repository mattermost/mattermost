// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file initializes a mock store for tests. It MUST be imported before any
// module that accesses the Redux store. This is configured as a setupFile in Jest.

import configureStore from 'redux-mock-store';
import {withExtraArgument as thunkWithExtraArgument} from 'redux-thunk';

// Minimal state structure required for tests to access common selectors
// This prevents "Cannot read properties of undefined" errors when selectors
// like getConfig() try to access state.entities.general.config
const initialMockState = {
    entities: {
        general: {
            config: {},
            license: {},
            serverVersion: '',
        },
        users: {
            currentUserId: '',
            profiles: {},
            statuses: {},
            profilesInChannel: {},
            profilesNotInChannel: {},
        },
        channels: {
            channels: {},
            channelsInTeam: {},
            myMembers: {},
            membersInChannel: {},
            stats: {},
        },
        teams: {
            currentTeamId: '',
            teams: {},
            myMembers: {},
            membersInTeam: {},
        },
        preferences: {
            myPreferences: {},
        },
        posts: {
            posts: {},
            postsInChannel: {},
            postsInThread: {},
            reactions: {},
            pendingPostIds: [],
        },
        emojis: {
            customEmoji: {},
            nonExistentEmoji: new Set(),
        },
        groups: {
            groups: {},
            syncables: {},
            myGroups: [],
            stats: {},
        },
        roles: {
            roles: {},
            pending: new Set(),
        },
        admin: {
            logs: [],
            audits: {},
            config: {},
            environmentConfig: {},
            complianceReports: {},
            ldapGroups: {},
            ldapGroupsCount: 0,
            userAccessTokens: {},
            pluginStatuses: {},
            plugins: {},
        },
        bots: {
            accounts: {},
        },
        typing: {},
        search: {
            results: [],
            fileResults: [],
            current: {},
            recent: {},
            matches: {},
            flagged: [],
            pinned: {},
            isSearchingTerm: false,
            isSearchGettingMore: false,
        },
        files: {
            files: {},
            filesFromSearch: {},
            fileIdsByPostId: {},
        },
        integrations: {
            incomingHooks: {},
            outgoingHooks: {},
            oauthApps: {},
            commands: {},
            systemCommands: {},
        },
        apps: {
            main: {
                bindings: [],
                forms: {},
            },
            rhs: {
                bindings: [],
                forms: {},
            },
            pluginEnabled: false,
        },
        threads: {
            threads: {},
            threadsInTeam: {},
            counts: {},
            countsIncludingDirect: {},
        },
        cloud: {},
        hostedCustomer: {
            products: {},
            invoices: {},
            subscriptionProduct: undefined,
        },
        usage: {
            files: {
                totalStorage: 0,
                totalStorageLoaded: false,
            },
            messages: {
                history: 0,
                historyLoaded: false,
            },
            boards: {
                cards: 0,
                cardsLoaded: false,
            },
            integrations: {
                enabled: 0,
                enabledLoaded: false,
            },
            teams: {
                active: 0,
                cloudArchived: 0,
                teamsLoaded: false,
            },
        },
    },
    views: {
        browser: {
            focused: true,
        },
        rhs: {
            selectedPostId: '',
            selectedChannelId: '',
            rhsState: null,
            isSidebarOpen: false,
            isExpanded: false,
            isSidebarExpanded: false,
        },
        channel: {
            loadingPosts: {},
            focusedPostId: '',
            mobileView: false,
            lastChannelViewTime: {},
            keepChannelIdAsUnread: null,
        },
        i18n: {
            translations: {
                en: {},
            },
        },
    },
    requests: {
        channels: {},
        general: {},
        posts: {},
        teams: {},
        users: {},
        admin: {},
        files: {},
        integrations: {},
    },
};

// Create a minimal mock store for tests
// This prevents "Redux store not initialized" errors when modules are imported
const mockStoreCreator = configureStore([thunkWithExtraArgument({loaders: {}})]);
const mockStore = mockStoreCreator(initialMockState);

// Set the store on window so redux_store.tsx can access it
/* eslint-disable no-underscore-dangle */
(window as any).__MM_STORE__ = mockStore;
(window as any).store = mockStore;
/* eslint-enable no-underscore-dangle */

export default mockStore;
