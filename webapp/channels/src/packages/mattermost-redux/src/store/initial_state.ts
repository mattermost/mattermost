// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {zeroStateLimitedViews} from '../reducers/entities/posts';

const state: GlobalState = {
    entities: {
        general: {
            config: {},
            license: {},
            serverVersion: '',
            firstAdminVisitMarketplaceStatus: false,
            firstAdminCompleteSetup: false,
            customProfileAttributes: {},
        },
        users: {
            currentUserId: '',
            isManualStatus: {},
            mySessions: [],
            myAudits: [],
            profiles: {},
            profilesInTeam: {},
            profilesNotInTeam: {},
            profilesWithoutTeam: new Set(),
            profilesInChannel: {},
            profilesNotInChannel: {},
            profilesInGroup: {},
            profilesNotInGroup: {},
            statuses: {},
            stats: {},
            filteredStats: {},
            myUserAccessTokens: {},
            lastActivity: {},
            dndEndTimes: {},
        },
        limits: {
            serverLimits: {
                activeUserCount: 0,
                maxUsersLimit: 0,
            },
        },
        teams: {
            currentTeamId: '',
            teams: {},
            myMembers: {},
            membersInTeam: {},
            stats: {},
            groupsAssociatedToTeam: {},
            totalCount: 0,
        },
        channels: {
            currentChannelId: '',
            channels: {},
            channelsInTeam: {},
            myMembers: {},
            membersInChannel: {},
            stats: {},
            roles: {},
            groupsAssociatedToChannel: {},
            totalCount: 0,
            manuallyUnread: {},
            channelModerations: {},
            channelMemberCountsByGroup: {},
            messageCounts: {},
            channelsMemberCount: {},
        },
        channelBookmarks: {
            byChannelId: {},
        },
        posts: {
            posts: {},
            postsReplies: {},
            postsInChannel: {},
            postsInThread: {},
            pendingPostIds: [],
            postEditHistory: [],
            reactions: {},
            openGraph: {},
            currentFocusedPostId: '',
            messagesHistory: {
                messages: [],
                index: {
                    post: -1,
                    comment: -1,
                },
            },
            limitedViews: zeroStateLimitedViews,
            acknowledgements: {},
        },
        threads: {
            threadsInTeam: {},
            unreadThreadsInTeam: {},
            threads: {},
            counts: {},
            countsIncludingDirect: {},
        },
        preferences: {
            myPreferences: {},
            userPreferences: {},
        },
        bots: {
            accounts: {},
        },
        admin: {
            logs: [],
            plainLogs: [],
            audits: {},
            config: {},
            environmentConfig: {},
            complianceReports: {},
            ldapGroups: {},
            ldapGroupsCount: 0,
            userAccessTokens: {},
            clusterInfo: [],
            analytics: {},
            teamAnalytics: {},
            dataRetentionCustomPolicies: {},
            dataRetentionCustomPoliciesCount: 0,
            prevTrialLicense: {},
            accessControlPolicies: {},
            channelsForAccessControlPolicy: {},
        },
        jobs: {
            jobs: {},
            jobsByTypeList: {},
        },
        integrations: {
            incomingHooks: {},
            incomingHooksTotalCount: 0,
            outgoingHooks: {},
            oauthApps: {},
            systemCommands: {},
            commands: {},
            appsBotIDs: [],
            appsOAuthAppIDs: [],
            dialogTriggerId: '',
            outgoingOAuthConnections: {},
        },
        files: {
            files: {},
            filesFromSearch: {},
            fileIdsByPostId: {},
        },
        emojis: {
            customEmoji: {},
            nonExistentEmoji: new Set(),
        },
        search: {
            results: [],
            fileResults: [],
            current: {},
            matches: {},
            flagged: [],
            pinned: {},
            isSearchingTerm: false,
            isSearchGettingMore: false,
            isLimitedResults: -1,
        },
        typing: {},
        roles: {
            roles: {},
            pending: new Set(),
        },
        schemes: {
            schemes: {},
        },
        groups: {
            groups: {},
            syncables: {},
            myGroups: [],
            stats: {},
        },
        channelCategories: {
            byId: {},
            orderByTeam: {},
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
            pluginEnabled: true,
        },
        cloud: {
            limits: {
                limits: {},
                limitsLoaded: false,
            },
            errors: {},
        },
        hostedCustomer: {
            products: {
                products: {},
                productsLoaded: false,
            },
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
            teams: {
                active: 0,
                cloudArchived: 0,
                teamsLoaded: false,
            },
        },
        scheduledPosts: {
            byId: {},
            byTeamId: {},
            errorsByTeamId: {},
            byChannelOrThreadId: {},
        },
    },
    errors: [],
    requests: {
        channels: {
            getAllChannels: {
                status: 'not_started',
                error: null,
            },
            getChannels: {
                status: 'not_started',
                error: null,
            },
            myChannels: {
                status: 'not_started',
                error: null,
            },
            createChannel: {
                status: 'not_started',
                error: null,
            },
        },
        general: {
            websocket: {
                status: 'not_started',
                error: null,
            },
        },
        posts: {
            createPost: {
                status: 'not_started',
                error: null,
            },
            editPost: {
                status: 'not_started',
                error: null,
            },
            getPostThread: {
                status: 'not_started',
                error: null,
            },
        },
        teams: {
            getTeams: {
                status: 'not_started',
                error: null,
            },
        },
        users: {
            login: {
                status: 'not_started',
                error: null,
            },
            logout: {
                status: 'not_started',
                error: null,
            },
            autocompleteUsers: {
                status: 'not_started',
                error: null,
            },
            updateMe: {
                status: 'not_started',
                error: null,
            },
        },
        admin: {
            createCompliance: {
                status: 'not_started',
                error: null,
            },
        },
        files: {
            uploadFiles: {
                status: 'not_started',
                error: null,
            },
        },
        roles: {
            getRolesByNames: {
                status: 'not_started',
                error: null,
            },
            getRoleByName: {
                status: 'not_started',
                error: null,
            },
            getRole: {
                status: 'not_started',
                error: null,
            },
            editRole: {
                status: 'not_started',
                error: null,
            },
        },
    },
    websocket: {
        connected: false,
        lastConnectAt: 0,
        lastDisconnectAt: 0,
        connectionId: '',
        serverHostname: '',
    },
};
export default state;
