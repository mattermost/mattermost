// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {interactiveDialogAppsFormEnabled} from './interactive_dialog';

describe('interactive_dialog selectors', () => {
    describe('interactiveDialogAppsFormEnabled', () => {
        const createMockState = (config: Partial<any> = {}): GlobalState => ({
            entities: {
                general: {
                    config,
                    license: {},
                    serverVersion: '',
                    timezones: [],
                    dataRetentionPolicy: {},
                    warnMetricsStatus: {},
                    firstAdminVisitMarketplaceStatus: false,
                    firstAdminCompleteSetup: false,
                    directorySamlSigninMap: {},
                },
                users: {
                    profiles: {},
                    profilesInTeam: {},
                    profilesNotInTeam: {},
                    profilesWithoutTeam: new Set(),
                    profilesInChannel: {},
                    profilesNotInChannel: {},
                    profilesInGroup: {},
                    statuses: {},
                    isManualStatus: {},
                    myUserAccessTokens: {},
                    stats: {},
                    filteredStats: {},
                    currentUserId: '',
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
                    roles: {},
                    stats: {},
                    groupsAssociatedToChannel: {},
                    totalCount: 0,
                    manuallyUnread: {},
                    channelModerations: {},
                    channelMemberCountsByGroup: {},
                },
                posts: {
                    posts: {},
                    postsInChannel: {},
                    postsInThread: {},
                    messagesHistory: {
                        messages: [],
                        index: {
                            post: -1,
                            comment: -1,
                        },
                    },
                    reactions: {},
                    openGraph: {},
                    selectedPostId: '',
                    currentFocusedPostId: '',
                    expandedURLs: {},
                },
                bots: {
                    accounts: {},
                },
                integrations: {
                    incomingHooks: {},
                    incomingHooksTotalCount: 0,
                    outgoingHooks: {},
                    oauthApps: {},
                    outgoingOAuthConnections: {},
                    appsOAuthAppIDs: [],
                    appsBotIDs: [],
                    systemCommands: {},
                    commands: {},
                    dialogTriggerId: '',
                },
                files: {
                    files: {},
                    filesFromSearch: {},
                    fileIdsByPostId: {},
                },
                preferences: {
                    myPreferences: {},
                },
                search: {
                    results: [],
                    fileResults: [],
                    flagged: [],
                    pinned: {},
                    current: {},
                    matches: {},
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                },
                roles: {
                    roles: {},
                    pending: new Set(),
                },
                schemes: {
                    schemes: {},
                },
                jobs: {
                    jobs: {},
                    jobsByTypeList: {},
                },
                admin: {
                    logs: [],
                    audits: {},
                    config: {},
                    environmentConfig: {},
                    complianceReports: {},
                    clusterInfo: [],
                    analytics: {},
                    teamAnalytics: {},
                    userAccessTokens: {},
                    plugins: {},
                    samlCertStatus: {},
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                    notices: [],
                    pluginStatuses: {},
                    ldapGroups: {},
                    ldapGroupsCount: 0,
                    userAccessTokensByUser: {},
                    dataRetentionCustomPolicies: {},
                    dataRetentionCustomPoliciesCount: 0,
                },
                emojis: {
                    customEmoji: {},
                    nonExistentEmoji: new Set(),
                },
                groups: {
                    syncables: {},
                    stats: {},
                    groups: {},
                    myGroups: [],
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
                    pluginEnabled: false,
                },
                cloud: {},
                limits: {
                    limitsLoaded: false,
                    serverLimits: {},
                },
                usage: {
                    messages: {
                        history: [],
                        messageCountSince: 0,
                        messageCountTotal: 0,
                    },
                    files: {
                        totalStorage: 0,
                        totalStorageLoaded: false,
                    },
                    boards: {
                        cards: 0,
                        cardsLoaded: false,
                    },
                    teams: {
                        active: 0,
                        cloudArchived: 0,
                        teamsLoaded: false,
                    },
                },
                hostedCustomer: {},
                insights: {
                    topReactions: [],
                    myTopReactions: [],
                    topChannels: [],
                    myTopChannels: [],
                    topThreads: [],
                    myTopThreads: [],
                    topTeams: [],
                    myTopTeams: [],
                    topDMs: [],
                    myTopDMs: [],
                    newTeamMembers: [],
                    myNewTeamMembers: [],
                    topPlaybooks: [],
                    myTopPlaybooks: [],
                    topBoards: [],
                    myTopBoards: [],
                },
            },
            errors: [],
            requests: {
                channels: {
                    getChannel: {
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
                    updateChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelNotifyProps: {
                        status: 'not_started',
                        error: null,
                    },
                    leaveChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    joinChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelMemberSchemeRoles: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelHeader: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelPurpose: {
                        status: 'not_started',
                        error: null,
                    },
                    markChannelAsRead: {
                        status: 'not_started',
                        error: null,
                    },
                    markChannelAsUnread: {
                        status: 'not_started',
                        error: null,
                    },
                    markChannelAsViewed: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelStats: {
                        status: 'not_started',
                        error: null,
                    },
                    addChannelMember: {
                        status: 'not_started',
                        error: null,
                    },
                    removeChannelMember: {
                        status: 'not_started',
                        error: null,
                    },
                    updateChannelMemberRoles: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelMember: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelMembers: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelTimezones: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelMembersByIds: {
                        status: 'not_started',
                        error: null,
                    },
                    getChannelMembersForUser: {
                        status: 'not_started',
                        error: null,
                    },
                },
                general: {
                    websocket: {
                        status: 'not_started',
                        error: null,
                    },
                    config: {
                        status: 'not_started',
                        error: null,
                    },
                    license: {
                        status: 'not_started',
                        error: null,
                    },
                    server: {
                        status: 'not_started',
                        error: null,
                    },
                    dataRetentionPolicy: {
                        status: 'not_started',
                        error: null,
                    },
                    redirectLocation: {
                        status: 'not_started',
                        error: null,
                    },
                },
                users: {
                    checkMfa: {
                        status: 'not_started',
                        error: null,
                    },
                    login: {
                        status: 'not_started',
                        error: null,
                    },
                    logout: {
                        status: 'not_started',
                        error: null,
                    },
                    create: {
                        status: 'not_started',
                        error: null,
                    },
                    getProfiles: {
                        status: 'not_started',
                        error: null,
                    },
                    getProfilesInTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    getProfilesInChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    getProfilesNotInChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    getUser: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserByUsername: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserByEmail: {
                        status: 'not_started',
                        error: null,
                    },
                    getStatusesByIds: {
                        status: 'not_started',
                        error: null,
                    },
                    getSessions: {
                        status: 'not_started',
                        error: null,
                    },
                    getTotalUsersStats: {
                        status: 'not_started',
                        error: null,
                    },
                    getFilteredUsersStats: {
                        status: 'not_started',
                        error: null,
                    },
                    revokeSession: {
                        status: 'not_started',
                        error: null,
                    },
                    getAudits: {
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
                    updateUser: {
                        status: 'not_started',
                        error: null,
                    },
                    updateUserRoles: {
                        status: 'not_started',
                        error: null,
                    },
                    updateUserMfa: {
                        status: 'not_started',
                        error: null,
                    },
                    updateUserPassword: {
                        status: 'not_started',
                        error: null,
                    },
                    resetUserPassword: {
                        status: 'not_started',
                        error: null,
                    },
                    generateMfaSecret: {
                        status: 'not_started',
                        error: null,
                    },
                    updateUserActive: {
                        status: 'not_started',
                        error: null,
                    },
                    verifyUserEmail: {
                        status: 'not_started',
                        error: null,
                    },
                    sendVerificationEmail: {
                        status: 'not_started',
                        error: null,
                    },
                    switchLogin: {
                        status: 'not_started',
                        error: null,
                    },
                    createUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserAccessTokens: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserAccessTokensForUser: {
                        status: 'not_started',
                        error: null,
                    },
                    revokeUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    disableUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    enableUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    getTermsOfService: {
                        status: 'not_started',
                        error: null,
                    },
                    updateTermsOfServiceStatus: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadProfileImage: {
                        status: 'not_started',
                        error: null,
                    },
                    setDefaultProfileImage: {
                        status: 'not_started',
                        error: null,
                    },
                    getKnownUsers: {
                        status: 'not_started',
                        error: null,
                    },
                    sendPasswordResetEmail: {
                        status: 'not_started',
                        error: null,
                    },
                    promoteGuestToUser: {
                        status: 'not_started',
                        error: null,
                    },
                    demoteUserToGuest: {
                        status: 'not_started',
                        error: null,
                    },
                },
                teams: {
                    getMyTeams: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeams: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    createTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    unarchiveTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    updateTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    patchTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    regenerateTeamInviteId: {
                        status: 'not_started',
                        error: null,
                    },
                    joinTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    leaveTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    addUserToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    addUsersToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    removeUserFromTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamStats: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamMembers: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamMember: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamMembersByIds: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamsForUser: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamMembersForUser: {
                        status: 'not_started',
                        error: null,
                    },
                    updateTeamMemberRoles: {
                        status: 'not_started',
                        error: null,
                    },
                    updateTeamMemberSchemeRoles: {
                        status: 'not_started',
                        error: null,
                    },
                    sendEmailInvitesToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    importTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    inviteGuestsToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    invalidateAllEmailInvites: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamInviteInfo: {
                        status: 'not_started',
                        error: null,
                    },
                    checkIfTeamExists: {
                        status: 'not_started',
                        error: null,
                    },
                    updateTeamScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    searchTeams: {
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
                    deletePost: {
                        status: 'not_started',
                        error: null,
                    },
                    getPostThread: {
                        status: 'not_started',
                        error: null,
                    },
                    getPostsAround: {
                        status: 'not_started',
                        error: null,
                    },
                    getPostsBefore: {
                        status: 'not_started',
                        error: null,
                    },
                    getPostsAfter: {
                        status: 'not_started',
                        error: null,
                    },
                    getPostsSince: {
                        status: 'not_started',
                        error: null,
                    },
                    reaction: {
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
                integrations: {
                    createIncomingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    getIncomingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    getIncomingHooks: {
                        status: 'not_started',
                        error: null,
                    },
                    updateIncomingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteIncomingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    createOutgoingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    getOutgoingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    getOutgoingHooks: {
                        status: 'not_started',
                        error: null,
                    },
                    updateOutgoingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteOutgoingHook: {
                        status: 'not_started',
                        error: null,
                    },
                    regenOutgoingHookToken: {
                        status: 'not_started',
                        error: null,
                    },
                    createCommand: {
                        status: 'not_started',
                        error: null,
                    },
                    getCustomTeamCommands: {
                        status: 'not_started',
                        error: null,
                    },
                    getCommandsList: {
                        status: 'not_started',
                        error: null,
                    },
                    updateCommand: {
                        status: 'not_started',
                        error: null,
                    },
                    regenCommandToken: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteCommand: {
                        status: 'not_started',
                        error: null,
                    },
                    addOAuthApp: {
                        status: 'not_started',
                        error: null,
                    },
                    editOAuthApp: {
                        status: 'not_started',
                        error: null,
                    },
                    getOAuthApps: {
                        status: 'not_started',
                        error: null,
                    },
                    getOAuthApp: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteOAuthApp: {
                        status: 'not_started',
                        error: null,
                    },
                    regenOAuthAppSecret: {
                        status: 'not_started',
                        error: null,
                    },
                    submitInteractiveDialog: {
                        status: 'not_started',
                        error: null,
                    },
                },
                preferences: {
                    getMyPreferences: {
                        status: 'not_started',
                        error: null,
                    },
                    savePreferences: {
                        status: 'not_started',
                        error: null,
                    },
                    deletePreferences: {
                        status: 'not_started',
                        error: null,
                    },
                },
                admin: {
                    getLogs: {
                        status: 'not_started',
                        error: null,
                    },
                    getAudits: {
                        status: 'not_started',
                        error: null,
                    },
                    getConfig: {
                        status: 'not_started',
                        error: null,
                    },
                    updateConfig: {
                        status: 'not_started',
                        error: null,
                    },
                    reloadConfig: {
                        status: 'not_started',
                        error: null,
                    },
                    testEmail: {
                        status: 'not_started',
                        error: null,
                    },
                    testSiteURL: {
                        status: 'not_started',
                        error: null,
                    },
                    testS3Connection: {
                        status: 'not_started',
                        error: null,
                    },
                    invalidateCaches: {
                        status: 'not_started',
                        error: null,
                    },
                    recycleDatabase: {
                        status: 'not_started',
                        error: null,
                    },
                    createCompliance: {
                        status: 'not_started',
                        error: null,
                    },
                    getCompliance: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadBrandImage: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteBrandImage: {
                        status: 'not_started',
                        error: null,
                    },
                    getClusterStatus: {
                        status: 'not_started',
                        error: null,
                    },
                    testLdap: {
                        status: 'not_started',
                        error: null,
                    },
                    syncLdap: {
                        status: 'not_started',
                        error: null,
                    },
                    getSamlCertificateStatus: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadSamlIdpCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    removeSamlIdpCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadSamlPublicCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    removeSamlPublicCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadSamlPrivateCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    removeSamlPrivateCertificate: {
                        status: 'not_started',
                        error: null,
                    },
                    testElasticsearch: {
                        status: 'not_started',
                        error: null,
                    },
                    purgeElasticsearchIndexes: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadLicense: {
                        status: 'not_started',
                        error: null,
                    },
                    removeLicense: {
                        status: 'not_started',
                        error: null,
                    },
                    getAnalytics: {
                        status: 'not_started',
                        error: null,
                    },
                    getTeamAnalytics: {
                        status: 'not_started',
                        error: null,
                    },
                    getUserAccessTokens: {
                        status: 'not_started',
                        error: null,
                    },
                    createUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    revokeUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    disableUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    enableUserAccessToken: {
                        status: 'not_started',
                        error: null,
                    },
                    getDataRetentionPolicy: {
                        status: 'not_started',
                        error: null,
                    },
                    createDataRetentionPolicy: {
                        status: 'not_started',
                        error: null,
                    },
                    getDataRetentionPolicies: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteDataRetentionPolicy: {
                        status: 'not_started',
                        error: null,
                    },
                    createComplianceReport: {
                        status: 'not_started',
                        error: null,
                    },
                    getComplianceReport: {
                        status: 'not_started',
                        error: null,
                    },
                    getComplianceReports: {
                        status: 'not_started',
                        error: null,
                    },
                    uploadPlugin: {
                        status: 'not_started',
                        error: null,
                    },
                    getPlugins: {
                        status: 'not_started',
                        error: null,
                    },
                    getPluginStatuses: {
                        status: 'not_started',
                        error: null,
                    },
                    removePlugin: {
                        status: 'not_started',
                        error: null,
                    },
                    enablePlugin: {
                        status: 'not_started',
                        error: null,
                    },
                    disablePlugin: {
                        status: 'not_started',
                        error: null,
                    },
                    updateServerBusy: {
                        status: 'not_started',
                        error: null,
                    },
                    getServerBusy: {
                        status: 'not_started',
                        error: null,
                    },
                    getLdapGroups: {
                        status: 'not_started',
                        error: null,
                    },
                    linkLdapGroup: {
                        status: 'not_started',
                        error: null,
                    },
                    unlinkLdapGroup: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroups: {
                        status: 'not_started',
                        error: null,
                    },
                    getJobsByType: {
                        status: 'not_started',
                        error: null,
                    },
                    createJob: {
                        status: 'not_started',
                        error: null,
                    },
                    cancelJob: {
                        status: 'not_started',
                        error: null,
                    },
                    patchConfig: {
                        status: 'not_started',
                        error: null,
                    },
                    getEnvironmentConfig: {
                        status: 'not_started',
                        error: null,
                    },
                    sendWarnMetricAck: {
                        status: 'not_started',
                        error: null,
                    },
                    sendTrialLicenseWarnMetricAck: {
                        status: 'not_started',
                        error: null,
                    },
                    requestTrialLicense: {
                        status: 'not_started',
                        error: null,
                    },
                    getLicenseRenewalLink: {
                        status: 'not_started',
                        error: null,
                    },
                    getSubscription: {
                        status: 'not_started',
                        error: null,
                    },
                    getInvoicesForSubscription: {
                        status: 'not_started',
                        error: null,
                    },
                    getSubscriptionStats: {
                        status: 'not_started',
                        error: null,
                    },
                },
                search: {
                    searchPosts: {
                        status: 'not_started',
                        error: null,
                    },
                    searchFiles: {
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
                schemes: {
                    getSchemes: {
                        status: 'not_started',
                        error: null,
                    },
                    createScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    getScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    patchScheme: {
                        status: 'not_started',
                        error: null,
                    },
                    getSchemeTeams: {
                        status: 'not_started',
                        error: null,
                    },
                    getSchemeChannels: {
                        status: 'not_started',
                        error: null,
                    },
                },
                jobs: {
                    createJob: {
                        status: 'not_started',
                        error: null,
                    },
                    getJob: {
                        status: 'not_started',
                        error: null,
                    },
                    getJobs: {
                        status: 'not_started',
                        error: null,
                    },
                    cancelJob: {
                        status: 'not_started',
                        error: null,
                    },
                    getJobsByType: {
                        status: 'not_started',
                        error: null,
                    },
                },
                bots: {
                    createBot: {
                        status: 'not_started',
                        error: null,
                    },
                    patchBot: {
                        status: 'not_started',
                        error: null,
                    },
                    getBot: {
                        status: 'not_started',
                        error: null,
                    },
                    getBots: {
                        status: 'not_started',
                        error: null,
                    },
                    disableBot: {
                        status: 'not_started',
                        error: null,
                    },
                    enableBot: {
                        status: 'not_started',
                        error: null,
                    },
                    assignBot: {
                        status: 'not_started',
                        error: null,
                    },
                },
                gifs: {
                    app: {
                        status: 'not_started',
                        error: null,
                    },
                    categories: {
                        status: 'not_started',
                        error: null,
                    },
                    search: {
                        status: 'not_started',
                        error: null,
                    },
                    trending: {
                        status: 'not_started',
                        error: null,
                    },
                },
                groups: {
                    getGroup: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroups: {
                        status: 'not_started',
                        error: null,
                    },
                    getAllGroupsAssociatedToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    getAllGroupsAssociatedToChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupsAssociatedToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupsAssociatedToChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupStats: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupsNotAssociatedToTeam: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupsNotAssociatedToChannel: {
                        status: 'not_started',
                        error: null,
                    },
                    linkGroupSyncable: {
                        status: 'not_started',
                        error: null,
                    },
                    unlinkGroupSyncable: {
                        status: 'not_started',
                        error: null,
                    },
                    patchGroupSyncable: {
                        status: 'not_started',
                        error: null,
                    },
                    getMyGroups: {
                        status: 'not_started',
                        error: null,
                    },
                    patchGroup: {
                        status: 'not_started',
                        error: null,
                    },
                    getGroupMembers: {
                        status: 'not_started',
                        error: null,
                    },
                },
                emojis: {
                    getCustomEmojis: {
                        status: 'not_started',
                        error: null,
                    },
                    getCustomEmoji: {
                        status: 'not_started',
                        error: null,
                    },
                    createCustomEmoji: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteCustomEmoji: {
                        status: 'not_started',
                        error: null,
                    },
                    searchCustomEmojis: {
                        status: 'not_started',
                        error: null,
                    },
                    autocompleteCustomEmojis: {
                        status: 'not_started',
                        error: null,
                    },
                },
                apps: {
                    fetchAppBindings: {
                        status: 'not_started',
                        error: null,
                    },
                },
                cloud: {
                    subscription: {
                        status: 'not_started',
                        error: null,
                    },
                    customer: {
                        status: 'not_started',
                        error: null,
                    },
                    invoices: {
                        status: 'not_started',
                        error: null,
                    },
                    subscriptionStats: {
                        status: 'not_started',
                        error: null,
                    },
                },
                usage: {
                    posts: {
                        status: 'not_started',
                        error: null,
                    },
                    storage: {
                        status: 'not_started',
                        error: null,
                    },
                    boards: {
                        status: 'not_started',
                        error: null,
                    },
                    teams: {
                        status: 'not_started',
                        error: null,
                    },
                },
                limits: {
                    serverLimits: {
                        status: 'not_started',
                        error: null,
                    },
                },
                hostedCustomer: {
                    get: {
                        status: 'not_started',
                        error: null,
                    },
                },
                channelCategories: {
                    getCategories: {
                        status: 'not_started',
                        error: null,
                    },
                    createCategory: {
                        status: 'not_started',
                        error: null,
                    },
                    updateCategory: {
                        status: 'not_started',
                        error: null,
                    },
                    updateCategories: {
                        status: 'not_started',
                        error: null,
                    },
                    deleteCategory: {
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
            },
            views: {
                admin: {
                    navigationBlock: {
                        blocked: false,
                        onNavigationConfirmed: null,
                        showNavigationPrompt: false,
                    },
                },
                announcement: {
                    announcementBarState: {
                        announcementBarCount: 1,
                        errorBarDisplayed: false,
                        noticeBarDisplayed: false,
                    },
                },
                browser: {
                    focused: true,
                    windowSize: 'DESKTOP',
                },
                channel: {
                    postVisibility: {},
                    loadingPosts: {},
                    focusedPostId: '',
                    retryFailed: {},
                    mobileView: false,
                    lastChannelViewTime: {},
                    loadingMorePostsVisible: false,
                    lastUnreadChannel: {},
                    unreadFilterEnabled: false,
                    lastUnreadChannel_v2: {},
                },
                rhs: {
                    selectedPostId: '',
                    selectedChannelId: '',
                    previousRhsState: null,
                    rhsState: null,
                    searchTerms: '',
                    searchType: '',
                    isSearchingFlaggedPost: false,
                    isSearchingPinnedPost: false,
                    isMenuOpen: false,
                    isSidebarOpen: false,
                    isSidebarExpanded: false,
                    searchResultsTerms: '',
                    pluggableId: '',
                    filesSearchExtFilter: [],
                },
                posts: {
                    editingPost: {},
                    menuActions: {},
                },
                modals: {
                    modalState: {},
                    showLaunchingWorkspace: false,
                },
                emoji: {
                    emojiPickerCustomPage: 0,
                },
                i18n: {
                    locale: 'en',
                },
                lhs: {
                    isOpen: false,
                },
                search: {
                    modalSearch: '',
                    userSearchFilter: '',
                    teamSearchFilter: '',
                    channelSearchFilter: '',
                    modalFilters: {
                        roles: [],
                    },
                    systemUsersSearch: {
                        term: '',
                        team: '',
                        filter: '',
                        loading: false,
                    },
                },
                notice: {
                    hasBeenDismissed: {},
                },
                system: {
                    websocketConnectionErrorCount: 0,
                    serverVersion: '',
                },
                team: {
                    lastTeamIconUpdate: {},
                },
                textbox: {
                    shouldShowPreviewOnCreateComment: false,
                    shouldShowPreviewOnCreatePost: false,
                    shouldShowPreviewOnEditChannelHeaderModal: false,
                },
                drafts: {
                    remotes: {},
                },
                statusDropdown: {
                    isOpen: false,
                },
                addChannelDropdown: {
                    isOpen: false,
                },
                insights: {
                    topReactions: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopReactions: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topChannels: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopChannels: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topThreads: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopThreads: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topDMs: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopDMs: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topTeams: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopTeams: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    newTeamMembers: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myNewTeamMembers: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topPlaybooks: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopPlaybooks: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    topBoards: {
                        loading: false,
                        timeFrame: 'today',
                    },
                    myTopBoards: {
                        loading: false,
                        timeFrame: 'today',
                    },
                },
            },
        } as any);

        test('should return true when feature flag is enabled', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'true',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(true);
        });

        test('should return false when feature flag is disabled', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'false',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is not present', () => {
            const state = createMockState({});

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is empty string', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: '',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is undefined', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: undefined,
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when config is empty', () => {
            const state = createMockState();

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should be case sensitive for true value', () => {
            const stateUppercase = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'TRUE',
            });

            const stateMixed = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'True',
            });

            expect(interactiveDialogAppsFormEnabled(stateUppercase)).toBe(false);
            expect(interactiveDialogAppsFormEnabled(stateMixed)).toBe(false);
        });
    });
});
