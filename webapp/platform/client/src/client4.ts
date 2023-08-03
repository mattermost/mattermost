// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import FormData from 'form-data';

import {PreferenceType} from '@mattermost/types/preferences';
import {SystemSetting} from '@mattermost/types/general';
import {ClusterInfo, AnalyticsRow, SchemaMigration, LogFilter} from '@mattermost/types/admin';
import type {AppBinding, AppCallRequest, AppCallResponse} from '@mattermost/types/apps';
import {Audit} from '@mattermost/types/audits';
import {UserAutocomplete, AutocompleteSuggestion} from '@mattermost/types/autocomplete';
import {Bot, BotPatch} from '@mattermost/types/bots';
import {
    Address,
    Product,
    CloudCustomer,
    CloudCustomerPatch,
    Invoice,
    Limits,
    NotifyAdminRequest,
    Subscription,
    ValidBusinessEmail,
    LicenseSelfServeStatus,
    CreateSubscriptionRequest,
    Feedback,
    WorkspaceDeletionRequest,
    NewsletterRequestBody,
} from '@mattermost/types/cloud';
import {
    SelfHostedSignupForm,
    SelfHostedSignupCustomerResponse,
    SelfHostedSignupSuccessResponse,
    SelfHostedSignupBootstrapResponse,
    SelfHostedExpansionRequest,
} from '@mattermost/types/hosted_customer';
import {ChannelCategory, OrderedChannelCategories} from '@mattermost/types/channel_categories';

import {
    Channel,
    ChannelMemberCountsByGroup,
    ChannelMembership,
    ChannelModeration,
    ChannelModerationPatch,
    ChannelStats,
    ChannelsWithTotalCount,
    ChannelUnread,
    ChannelViewResponse,
    ChannelWithTeamData,
    ChannelSearchOpts,
    ServerChannel,
} from '@mattermost/types/channels';
import {Options, StatusOK, ClientResponse, LogLevel, FetchPaginatedThreadOptions} from '@mattermost/types/client4';
import {Compliance} from '@mattermost/types/compliance';
import {
    ClientConfig,
    ClientLicense,
    DataRetentionPolicy,
    License,
    AdminConfig,
    EnvironmentConfig,
    RequestLicenseBody,
} from '@mattermost/types/config';
import {CustomEmoji} from '@mattermost/types/emojis';
import {ServerError} from '@mattermost/types/errors';
import {FileInfo, FileUploadResponse, FileSearchResults} from '@mattermost/types/files';
import {
    Group,
    GroupPatch,
    GroupSyncable,
    MixedUnlinkedGroup,
    SyncablePatch,
    UsersWithGroupsAndCount,
    GroupsWithCount,
    GroupCreateWithUserIds,
    GroupSearachParams,
    CustomGroupPatch,
} from '@mattermost/types/groups';
import {PostActionResponse} from '@mattermost/types/integration_actions';
import {
    Command,
    CommandArgs,
    CommandResponse,
    DialogSubmission,
    IncomingWebhook,
    OAuthApp,
    OutgoingWebhook,
    SubmitDialogResponse,
} from '@mattermost/types/integrations';
import {Job} from '@mattermost/types/jobs';
import {MfaSecret} from '@mattermost/types/mfa';
import {
    ClientPluginManifest,
    PluginManifest,
    PluginsResponse,
    PluginStatus,
} from '@mattermost/types/plugins';
import type {
    MarketplaceApp,
    MarketplacePlugin,
} from '@mattermost/types/marketplace';
import {Post, PostList, PostSearchResults, OpenGraphMetadata, PostsUsageResponse, TeamsUsageResponse, PaginatedPostList, FilesUsageResponse, PostAcknowledgement, PostAnalytics} from '@mattermost/types/posts';
import {Draft} from '@mattermost/types/drafts';
import {Reaction} from '@mattermost/types/reactions';
import {Role} from '@mattermost/types/roles';
import {SamlCertificateStatus, SamlMetadataResponse} from '@mattermost/types/saml';
import {Scheme} from '@mattermost/types/schemes';
import {Session} from '@mattermost/types/sessions';
import {
    GetTeamMembersOpts,
    Team,
    TeamInviteWithError,
    TeamMembership,
    TeamMemberWithError,
    TeamStats,
    TeamsWithCount,
    TeamUnread,
    TeamSearchOpts,
} from '@mattermost/types/teams';
import {TermsOfService} from '@mattermost/types/terms_of_service';
import {
    AuthChangeResponse,
    UserAccessToken,
    UserProfile,
    UsersStats,
    UserStatus,
    GetFilteredUsersStatsOpts,
    UserCustomStatus,
} from '@mattermost/types/users';
import {DeepPartial, RelationOneToOne} from '@mattermost/types/utilities';
import {ProductNotices} from '@mattermost/types/product_notices';
import {
    DataRetentionCustomPolicies,
    CreateDataRetentionCustomPolicy,
    PatchDataRetentionCustomPolicy,
    GetDataRetentionCustomPoliciesRequest,
} from '@mattermost/types/data_retention';
import {CompleteOnboardingRequest} from '@mattermost/types/setup';
import {UserThreadList, UserThread, UserThreadWithPost} from '@mattermost/types/threads';

import {cleanUrlForLogging} from './errors';
import {buildQueryString} from './helpers';
import {TelemetryHandler} from './telemetry';

const HEADER_AUTH = 'Authorization';
const HEADER_BEARER = 'BEARER';
const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_REQUESTED_WITH = 'X-Requested-With';
const HEADER_USER_AGENT = 'User-Agent';
export const HEADER_X_CLUSTER_ID = 'X-Cluster-Id';
const HEADER_X_CSRF_TOKEN = 'X-CSRF-Token';
export const HEADER_X_VERSION_ID = 'X-Version-Id';
const LOGS_PER_PAGE_DEFAULT = 10000;
const AUTOCOMPLETE_LIMIT_DEFAULT = 25;
const PER_PAGE_DEFAULT = 60;
export const DEFAULT_LIMIT_BEFORE = 30;
export const DEFAULT_LIMIT_AFTER = 30;

const GRAPHQL_ENDPOINT = '/api/v5/graphql';

export default class Client4 {
    logToConsole = false;
    serverVersion = '';
    clusterId = '';
    token = '';
    csrf = '';
    url = '';
    urlVersion = '/api/v4';
    userAgent: string|null = null;
    enableLogging = false;
    defaultHeaders: {[x: string]: string} = {};
    userId = '';
    diagnosticId = '';
    includeCookies = true;
    setAuthHeader = true;
    translations = {
        connectionError: 'There appears to be a problem with your internet connection.',
        unknownError: 'We received an unexpected status code from the server.',
    };
    userRoles = '';
    telemetryHandler?: TelemetryHandler;

    getUrl() {
        return this.url;
    }

    getAbsoluteUrl(baseUrl: string) {
        if (typeof baseUrl !== 'string' || !baseUrl.startsWith('/')) {
            return baseUrl;
        }
        return this.getUrl() + baseUrl;
    }

    getGraphQLUrl() {
        return `${this.url}${GRAPHQL_ENDPOINT}`;
    }

    setUrl(url: string) {
        this.url = url;
    }

    setUserAgent(userAgent: string) {
        this.userAgent = userAgent;
    }

    getToken() {
        return this.token;
    }

    setToken(token: string) {
        this.token = token;
    }

    setCSRF(csrfToken: string) {
        this.csrf = csrfToken;
    }

    setAcceptLanguage(locale: string) {
        this.defaultHeaders['Accept-Language'] = locale;
    }

    setEnableLogging(enable: boolean) {
        this.enableLogging = enable;
    }

    setIncludeCookies(include: boolean) {
        this.includeCookies = include;
    }

    setUserId(userId: string) {
        this.userId = userId;
    }

    setUserRoles(roles: string) {
        this.userRoles = roles;
    }

    setDiagnosticId(diagnosticId: string) {
        this.diagnosticId = diagnosticId;
    }

    setTelemetryHandler(telemetryHandler?: TelemetryHandler) {
        this.telemetryHandler = telemetryHandler;
    }

    getServerVersion() {
        return this.serverVersion;
    }

    getUrlVersion() {
        return this.urlVersion;
    }

    getBaseRoute() {
        return `${this.url}${this.urlVersion}`;
    }

    getAppsProxyRoute() {
        return `${this.url}/plugins/com.mattermost.apps`;
    }

    getUsersRoute() {
        return `${this.getBaseRoute()}/users`;
    }

    getUserRoute(userId: string) {
        return `${this.getUsersRoute()}/${userId}`;
    }

    getTeamsRoute() {
        return `${this.getBaseRoute()}/teams`;
    }

    getTeamRoute(teamId: string) {
        return `${this.getTeamsRoute()}/${teamId}`;
    }

    getTeamSchemeRoute(teamId: string) {
        return `${this.getTeamRoute(teamId)}/scheme`;
    }

    getTeamNameRoute(teamName: string) {
        return `${this.getTeamsRoute()}/name/${teamName}`;
    }

    getTeamMembersRoute(teamId: string) {
        return `${this.getTeamRoute(teamId)}/members`;
    }

    getTeamMemberRoute(teamId: string, userId: string) {
        return `${this.getTeamMembersRoute(teamId)}/${userId}`;
    }

    getChannelsRoute() {
        return `${this.getBaseRoute()}/channels`;
    }

    getChannelRoute(channelId: string) {
        return `${this.getChannelsRoute()}/${channelId}`;
    }

    getChannelMembersRoute(channelId: string) {
        return `${this.getChannelRoute(channelId)}/members`;
    }

    getChannelMemberRoute(channelId: string, userId: string) {
        return `${this.getChannelMembersRoute(channelId)}/${userId}`;
    }

    getChannelSchemeRoute(channelId: string) {
        return `${this.getChannelRoute(channelId)}/scheme`;
    }

    getChannelCategoriesRoute(userId: string, teamId: string) {
        return `${this.getBaseRoute()}/users/${userId}/teams/${teamId}/channels/categories`;
    }

    getPostsRoute() {
        return `${this.getBaseRoute()}/posts`;
    }

    getPostRoute(postId: string) {
        return `${this.getPostsRoute()}/${postId}`;
    }

    getReactionsRoute() {
        return `${this.getBaseRoute()}/reactions`;
    }

    getCommandsRoute() {
        return `${this.getBaseRoute()}/commands`;
    }

    getFilesRoute() {
        return `${this.getBaseRoute()}/files`;
    }

    getFileRoute(fileId: string) {
        return `${this.getFilesRoute()}/${fileId}`;
    }

    getPreferencesRoute(userId: string) {
        return `${this.getUserRoute(userId)}/preferences`;
    }

    getIncomingHooksRoute() {
        return `${this.getBaseRoute()}/hooks/incoming`;
    }

    getIncomingHookRoute(hookId: string) {
        return `${this.getBaseRoute()}/hooks/incoming/${hookId}`;
    }

    getOutgoingHooksRoute() {
        return `${this.getBaseRoute()}/hooks/outgoing`;
    }

    getOutgoingHookRoute(hookId: string) {
        return `${this.getBaseRoute()}/hooks/outgoing/${hookId}`;
    }

    getOAuthRoute() {
        return `${this.url}/oauth`;
    }

    getOAuthAppsRoute() {
        return `${this.getBaseRoute()}/oauth/apps`;
    }

    getOAuthAppRoute(appId: string) {
        return `${this.getOAuthAppsRoute()}/${appId}`;
    }

    getEmojisRoute() {
        return `${this.getBaseRoute()}/emoji`;
    }

    getEmojiRoute(emojiId: string) {
        return `${this.getEmojisRoute()}/${emojiId}`;
    }

    getBrandRoute() {
        return `${this.getBaseRoute()}/brand`;
    }

    getBrandImageUrl(timestamp: string) {
        return `${this.getBrandRoute()}/image?t=${timestamp}`;
    }

    getDataRetentionRoute() {
        return `${this.getBaseRoute()}/data_retention`;
    }

    getJobsRoute() {
        return `${this.getBaseRoute()}/jobs`;
    }

    getPluginsRoute() {
        return `${this.getBaseRoute()}/plugins`;
    }

    getPluginRoute(pluginId: string) {
        return `${this.getPluginsRoute()}/${pluginId}`;
    }

    getPluginsMarketplaceRoute() {
        return `${this.getPluginsRoute()}/marketplace`;
    }

    getRolesRoute() {
        return `${this.getBaseRoute()}/roles`;
    }

    getSchemesRoute() {
        return `${this.getBaseRoute()}/schemes`;
    }

    getRedirectLocationRoute() {
        return `${this.getBaseRoute()}/redirect_location`;
    }

    getBotsRoute() {
        return `${this.getBaseRoute()}/bots`;
    }

    getBotRoute(botUserId: string) {
        return `${this.getBotsRoute()}/${botUserId}`;
    }

    getGroupsRoute() {
        return `${this.getBaseRoute()}/groups`;
    }

    getGroupRoute(groupID: string) {
        return `${this.getGroupsRoute()}/${groupID}`;
    }

    getNoticesRoute() {
        return `${this.getBaseRoute()}/system/notices`;
    }

    getCloudRoute() {
        return `${this.getBaseRoute()}/cloud`;
    }

    getHostedCustomerRoute() {
        return `${this.getBaseRoute()}/hosted_customer`;
    }

    getUsageRoute() {
        return `${this.getBaseRoute()}/usage`;
    }

    getPermissionsRoute() {
        return `${this.getBaseRoute()}/permissions`;
    }

    getUserThreadsRoute(userID: string, teamID: string): string {
        return `${this.getUserRoute(userID)}/teams/${teamID}/threads`;
    }

    getUserThreadRoute(userId: string, teamId: string, threadId: string): string {
        return `${this.getUserThreadsRoute(userId, teamId)}/${threadId}`;
    }

    getSystemRoute(): string {
        return `${this.getBaseRoute()}/system`;
    }

    getDraftsRoute() {
        return `${this.getBaseRoute()}/drafts`;
    }

    getCSRFFromCookie() {
        if (typeof document !== 'undefined' && typeof document.cookie !== 'undefined') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.startsWith('MMCSRF=')) {
                    return cookie.replace('MMCSRF=', '');
                }
            }
        }
        return '';
    }

    getOptions(options: Options) {
        const newOptions: Options = {...options};

        const headers: {[x: string]: string} = {
            [HEADER_REQUESTED_WITH]: 'XMLHttpRequest',
            ...this.defaultHeaders,
        };

        if (this.setAuthHeader && this.token) {
            headers[HEADER_AUTH] = `${HEADER_BEARER} ${this.token}`;
        }

        const csrfToken = this.csrf || this.getCSRFFromCookie();
        if (options.method && options.method.toLowerCase() !== 'get' && csrfToken) {
            headers[HEADER_X_CSRF_TOKEN] = csrfToken;
        }

        if (this.includeCookies) {
            newOptions.credentials = 'include';
        }

        if (this.userAgent) {
            headers[HEADER_USER_AGENT] = this.userAgent;
        }

        if (!headers[HEADER_CONTENT_TYPE] && options.body) {
            // when the body is an instance of FormData we let browser set the Content-Type header generated by FormData interface with correct boundary
            if (!(options.body instanceof FormData)) {
                headers[HEADER_CONTENT_TYPE] = 'application/json';
            }
        }

        if (newOptions.headers) {
            Object.assign(headers, newOptions.headers);
        }

        return {
            ...newOptions,
            headers,
        };
    }

    // User Routes

    createUser = (user: UserProfile, token: string, inviteId: string, redirect?: string) => {
        this.trackEvent('api', 'api_users_create');

        const queryParams: any = {};

        if (token) {
            queryParams.t = token;
        }

        if (inviteId) {
            queryParams.iid = inviteId;
        }

        if (redirect) {
            queryParams.r = redirect;
        }

        return this.doFetch<UserProfile>(
            `${this.getUsersRoute()}${buildQueryString(queryParams)}`,
            {method: 'post', body: JSON.stringify(user)},
        );
    }

    patchMe = (userPatch: Partial<UserProfile>) => {
        return this.doFetch<UserProfile>(
            `${this.getUserRoute('me')}/patch`,
            {method: 'put', body: JSON.stringify(userPatch)},
        );
    }

    patchUser = (userPatch: Partial<UserProfile> & {id: string}) => {
        this.trackEvent('api', 'api_users_patch');

        return this.doFetch<UserProfile>(
            `${this.getUserRoute(userPatch.id)}/patch`,
            {method: 'put', body: JSON.stringify(userPatch)},
        );
    }

    updateUser = (user: UserProfile) => {
        this.trackEvent('api', 'api_users_update');

        return this.doFetch<UserProfile>(
            `${this.getUserRoute(user.id)}`,
            {method: 'put', body: JSON.stringify(user)},
        );
    }

    promoteGuestToUser = (userId: string) => {
        this.trackEvent('api', 'api_users_promote_guest_to_user');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/promote`,
            {method: 'post'},
        );
    }

    demoteUserToGuest = (userId: string) => {
        this.trackEvent('api', 'api_users_demote_user_to_guest');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/demote`,
            {method: 'post'},
        );
    }

    updateUserRoles = (userId: string, roles: string) => {
        this.trackEvent('api', 'api_users_update_roles');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/roles`,
            {method: 'put', body: JSON.stringify({roles})},
        );
    };

    updateUserMfa = (userId: string, activate: boolean, code: string) => {
        const body: any = {
            activate,
        };

        if (activate) {
            body.code = code;
        }

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/mfa`,
            {method: 'put', body: JSON.stringify(body)},
        );
    }

    updateUserPassword = (userId: string, currentPassword: string, newPassword: string) => {
        this.trackEvent('api', 'api_users_newpassword');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/password`,
            {method: 'put', body: JSON.stringify({current_password: currentPassword, new_password: newPassword})},
        );
    }

    resetUserPassword = (token: string, newPassword: string) => {
        this.trackEvent('api', 'api_users_reset_password');

        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/password/reset`,
            {method: 'post', body: JSON.stringify({token, new_password: newPassword})},
        );
    }

    getKnownUsers = () => {
        return this.doFetch<Array<UserProfile['id']>>(
            `${this.getUsersRoute()}/known`,
            {method: 'get'},
        );
    }

    sendPasswordResetEmail = (email: string) => {
        this.trackEvent('api', 'api_users_send_password_reset');

        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/password/reset/send`,
            {method: 'post', body: JSON.stringify({email})},
        );
    }

    updateUserActive = (userId: string, active: boolean) => {
        this.trackEvent('api', 'api_users_update_active');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/active`,
            {method: 'put', body: JSON.stringify({active})},
        );
    }

    uploadProfileImage = (userId: string, imageData: File) => {
        this.trackEvent('api', 'api_users_update_profile_picture');

        const formData = new FormData();
        formData.append('image', imageData);
        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/image`,
            request,
        );
    };

    setDefaultProfileImage = (userId: string) => {
        this.trackEvent('api', 'api_users_set_default_profile_picture');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/image`,
            {method: 'delete'},
        );
    };

    verifyUserEmail = (token: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/email/verify`,
            {method: 'post', body: JSON.stringify({token})},
        );
    }

    updateMyTermsOfServiceStatus = (termsOfServiceId: string, accepted: boolean) => {
        return this.doFetch<StatusOK>(
            `${this.getUserRoute('me')}/terms_of_service`,
            {method: 'post', body: JSON.stringify({termsOfServiceId, accepted})},
        );
    }

    getTermsOfService = () => {
        return this.doFetch<TermsOfService>(
            `${this.getBaseRoute()}/terms_of_service`,
            {method: 'get'},
        );
    }

    createTermsOfService = (text: string) => {
        return this.doFetch<TermsOfService>(
            `${this.getBaseRoute()}/terms_of_service`,
            {method: 'post', body: JSON.stringify({text})},
        );
    }

    sendVerificationEmail = (email: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/email/verify/send`,
            {method: 'post', body: JSON.stringify({email})},
        );
    }

    login = async (loginId: string, password: string, token = '', ldapOnly = false) => {
        this.trackEvent('api', 'api_users_login');

        if (ldapOnly) {
            this.trackEvent('api', 'api_users_login_ldap');
        }

        const body: any = {
            login_id: loginId,
            password,
            token,
            deviceId: '',
        };

        if (ldapOnly) {
            body.ldap_only = 'true';
        }

        const {
            data: profile,
            headers,
        } = await this.doFetchWithResponse<UserProfile>(
            `${this.getUsersRoute()}/login`,
            {method: 'post', body: JSON.stringify(body)},
        );

        if (headers.has('Token')) {
            this.setToken(headers.get('Token')!);
        }

        return profile;
    };

    loginById = (id: string, password: string, token = '') => {
        this.trackEvent('api', 'api_users_login');
        const body: any = {
            id,
            password,
            token,
            device_id: '',
        };

        return this.doFetch<UserProfile>(
            `${this.getUsersRoute()}/login`,
            {method: 'post', body: JSON.stringify(body)},
        );
    };

    logout = async () => {
        this.trackEvent('api', 'api_users_logout');

        const {response} = await this.doFetchWithResponse(
            `${this.getUsersRoute()}/logout`,
            {method: 'post'},
        );

        if (response.ok) {
            this.token = '';
        }

        this.serverVersion = '';

        return response;
    };

    getProfiles = (page = 0, perPage = PER_PAGE_DEFAULT, options: Record<string, any> = {}) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({page, per_page: perPage, ...options})}`,
            {method: 'get'},
        );
    };

    getProfilesByIds = (userIds: string[], options = {}) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}/ids${buildQueryString(options)}`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    getProfilesByUsernames = (usernames: string[]) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}/usernames`,
            {method: 'post', body: JSON.stringify(usernames)},
        );
    };

    getProfilesInTeam = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT, sort = '', options = {}) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({...options, in_team: teamId, page, per_page: perPage, sort})}`,
            {method: 'get'},
        );
    };

    getProfilesNotInTeam = (teamId: string, groupConstrained: boolean, page = 0, perPage = PER_PAGE_DEFAULT) => {
        const queryStringObj: any = {not_in_team: teamId, page, per_page: perPage};
        if (groupConstrained) {
            queryStringObj.group_constrained = true;
        }

        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString(queryStringObj)}`,
            {method: 'get'},
        );
    };

    getProfilesWithoutTeam = (page = 0, perPage = PER_PAGE_DEFAULT, options = {}) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({...options, without_team: 1, page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getProfilesInChannel = (channelId: string, page = 0, perPage = PER_PAGE_DEFAULT, sort = '', options: {active?: boolean} = {}) => {
        const queryStringObj = {in_channel: channelId, page, per_page: perPage, sort};

        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({...queryStringObj, ...options})}`,
            {method: 'get'},
        );
    };

    getProfilesInGroupChannels = (channelsIds: string[]) => {
        return this.doFetch<Record<string, UserProfile[]>>(
            `${this.getUsersRoute()}/group_channels`,
            {method: 'post', body: JSON.stringify(channelsIds)},
        );
    };

    getProfilesNotInChannel = (teamId: string, channelId: string, groupConstrained: boolean, page = 0, perPage = PER_PAGE_DEFAULT) => {
        const queryStringObj: any = {in_team: teamId, not_in_channel: channelId, page, per_page: perPage};
        if (groupConstrained) {
            queryStringObj.group_constrained = true;
        }

        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString(queryStringObj)}`,
            {method: 'get'},
        );
    };

    getProfilesInGroup = (groupId: string, page = 0, perPage = PER_PAGE_DEFAULT, sort = '') => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({in_group: groupId, page, per_page: perPage, sort})}`,
            {method: 'get'},
        );
    };

    getProfilesNotInGroup = (groupId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}${buildQueryString({not_in_group: groupId, page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getMe = () => {
        return this.doFetch<UserProfile>(
            `${this.getUserRoute('me')}`,
            {method: 'get'},
        );
    };

    getUser = (userId: string) => {
        return this.doFetch<UserProfile>(
            `${this.getUserRoute(userId)}`,
            {method: 'get'},
        );
    };

    getUserByUsername = (username: string) => {
        return this.doFetch<UserProfile>(
            `${this.getUsersRoute()}/username/${username}`,
            {method: 'get'},
        );
    };

    getUserByEmail = (email: string) => {
        return this.doFetch<UserProfile>(
            `${this.getUsersRoute()}/email/${email}`,
            {method: 'get'},
        );
    };

    getProfilePictureUrl = (userId: string, lastPictureUpdate: number) => {
        const params: any = {};

        if (lastPictureUpdate) {
            params._ = lastPictureUpdate;
        }

        return `${this.getUserRoute(userId)}/image${buildQueryString(params)}`;
    };

    getDefaultProfilePictureUrl = (userId: string) => {
        return `${this.getUserRoute(userId)}/image/default`;
    };

    autocompleteUsers = (name: string, teamId: string, channelId: string, options = {
        limit: AUTOCOMPLETE_LIMIT_DEFAULT,
    }) => {
        return this.doFetch<UserAutocomplete>(`${this.getUsersRoute()}/autocomplete${buildQueryString({
            in_team: teamId,
            in_channel: channelId,
            name,
            limit: options.limit,
        })}`, {
            method: 'get',
        });
    };

    getSessions = (userId: string) => {
        return this.doFetch<Session[]>(
            `${this.getUserRoute(userId)}/sessions`,
            {method: 'get'},
        );
    };

    revokeSession = (userId: string, sessionId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/sessions/revoke`,
            {method: 'post', body: JSON.stringify({session_id: sessionId})},
        );
    };

    revokeAllSessionsForUser = (userId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/sessions/revoke/all`,
            {method: 'post'},
        );
    };

    revokeSessionsForAllUsers = () => {
        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/sessions/revoke/all`,
            {method: 'post'},
        );
    };

    getUserAudits = (userId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Audit[]>(
            `${this.getUserRoute(userId)}/audits${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    /**
     * @deprecated
     */
    checkUserMfa = (loginId: string) => {
        return this.doFetch<{mfa_required: boolean}>(
            `${this.getUsersRoute()}/mfa`,
            {method: 'post', body: JSON.stringify({login_id: loginId})},
        );
    };

    generateMfaSecret = (userId: string) => {
        return this.doFetch<MfaSecret>(
            `${this.getUserRoute(userId)}/mfa/generate`,
            {method: 'post'},
        );
    };

    searchUsers = (term: string, options: any) => {
        this.trackEvent('api', 'api_search_users');

        return this.doFetch<UserProfile[]>(
            `${this.getUsersRoute()}/search`,
            {method: 'post', body: JSON.stringify({term, ...options})},
        );
    };

    getStatusesByIds = (userIds: string[]) => {
        return this.doFetch<UserStatus[]>(
            `${this.getUsersRoute()}/status/ids`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    getStatus = (userId: string) => {
        return this.doFetch<UserStatus>(
            `${this.getUserRoute(userId)}/status`,
            {method: 'get'},
        );
    };

    updateStatus = (status: UserStatus) => {
        return this.doFetch<UserStatus>(
            `${this.getUserRoute(status.user_id)}/status`,
            {method: 'put', body: JSON.stringify(status)},
        );
    };

    updateCustomStatus = (customStatus: UserCustomStatus) => {
        return this.doFetch(
            `${this.getUserRoute('me')}/status/custom`,
            {method: 'put', body: JSON.stringify(customStatus)},
        );
    };

    unsetCustomStatus = () => {
        return this.doFetch(
            `${this.getUserRoute('me')}/status/custom`,
            {method: 'delete'},
        );
    }

    removeRecentCustomStatus = (customStatus: UserCustomStatus) => {
        return this.doFetch(
            `${this.getUserRoute('me')}/status/custom/recent/delete`,
            {method: 'post', body: JSON.stringify(customStatus)},
        );
    }

    switchEmailToOAuth = (service: string, email: string, password: string, mfaCode = '') => {
        this.trackEvent('api', 'api_users_email_to_oauth');

        return this.doFetch<AuthChangeResponse>(
            `${this.getUsersRoute()}/login/switch`,
            {method: 'post', body: JSON.stringify({current_service: 'email', new_service: service, email, password, mfa_code: mfaCode})},
        );
    };

    switchOAuthToEmail = (currentService: string, email: string, password: string) => {
        this.trackEvent('api', 'api_users_oauth_to_email');

        return this.doFetch<AuthChangeResponse>(
            `${this.getUsersRoute()}/login/switch`,
            {method: 'post', body: JSON.stringify({current_service: currentService, new_service: 'email', email, new_password: password})},
        );
    };

    switchEmailToLdap = (email: string, emailPassword: string, ldapId: string, ldapPassword: string, mfaCode = '') => {
        this.trackEvent('api', 'api_users_email_to_ldap');

        return this.doFetch<AuthChangeResponse>(
            `${this.getUsersRoute()}/login/switch`,
            {method: 'post', body: JSON.stringify({current_service: 'email', new_service: 'ldap', email, password: emailPassword, ldap_id: ldapId, new_password: ldapPassword, mfa_code: mfaCode})},
        );
    };

    switchLdapToEmail = (ldapPassword: string, email: string, emailPassword: string, mfaCode = '') => {
        this.trackEvent('api', 'api_users_ldap_to_email');

        return this.doFetch<AuthChangeResponse>(
            `${this.getUsersRoute()}/login/switch`,
            {method: 'post', body: JSON.stringify({current_service: 'ldap', new_service: 'email', email, password: ldapPassword, new_password: emailPassword, mfa_code: mfaCode})},
        );
    };

    getAuthorizedOAuthApps = (userId: string) => {
        return this.doFetch<OAuthApp[]>(
            `${this.getUserRoute(userId)}/oauth/apps/authorized`,
            {method: 'get'},
        );
    }

    authorizeOAuthApp = (responseType: string, clientId: string, redirectUri: string, state: string, scope: string) => {
        return this.doFetch<void>(
            `${this.url}/oauth/authorize`,
            {method: 'post', body: JSON.stringify({client_id: clientId, response_type: responseType, redirect_uri: redirectUri, state, scope})},
        );
    }

    deauthorizeOAuthApp = (clientId: string) => {
        return this.doFetch<StatusOK>(
            `${this.url}/oauth/deauthorize`,
            {method: 'post', body: JSON.stringify({client_id: clientId})},
        );
    }

    createUserAccessToken = (userId: string, description: string) => {
        this.trackEvent('api', 'api_users_create_access_token');

        return this.doFetch<UserAccessToken>(
            `${this.getUserRoute(userId)}/tokens`,
            {method: 'post', body: JSON.stringify({description})},
        );
    }

    getUserAccessToken = (tokenId: string) => {
        return this.doFetch<UserAccessToken>(
            `${this.getUsersRoute()}/tokens/${tokenId}`,
            {method: 'get'},
        );
    }

    getUserAccessTokensForUser = (userId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<UserAccessToken[]>(
            `${this.getUserRoute(userId)}/tokens${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    getUserAccessTokens = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<UserAccessToken[]>(
            `${this.getUsersRoute()}/tokens${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    revokeUserAccessToken = (tokenId: string) => {
        this.trackEvent('api', 'api_users_revoke_access_token');

        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/tokens/revoke`,
            {method: 'post', body: JSON.stringify({token_id: tokenId})},
        );
    }

    disableUserAccessToken = (tokenId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/tokens/disable`,
            {method: 'post', body: JSON.stringify({token_id: tokenId})},
        );
    }

    enableUserAccessToken = (tokenId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getUsersRoute()}/tokens/enable`,
            {method: 'post', body: JSON.stringify({token_id: tokenId})},
        );
    }

    // Team Routes

    createTeam = (team: Team) => {
        this.trackEvent('api', 'api_teams_create');

        return this.doFetch<Team>(
            `${this.getTeamsRoute()}`,
            {method: 'post', body: JSON.stringify(team)},
        );
    };

    deleteTeam = (teamId: string) => {
        this.trackEvent('api', 'api_teams_delete');

        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}`,
            {method: 'delete'},
        );
    };

    unarchiveTeam = (teamId: string) => {
        return this.doFetch<Team>(
            `${this.getTeamRoute(teamId)}/restore`,
            {method: 'post'},
        );
    }

    updateTeam = (team: Team) => {
        this.trackEvent('api', 'api_teams_update_name', {team_id: team.id});

        return this.doFetch<Team>(
            `${this.getTeamRoute(team.id)}`,
            {method: 'put', body: JSON.stringify(team)},
        );
    };

    patchTeam = (team: Partial<Team> & {id: string}) => {
        this.trackEvent('api', 'api_teams_patch_name', {team_id: team.id});

        return this.doFetch<Team>(
            `${this.getTeamRoute(team.id)}/patch`,
            {method: 'put', body: JSON.stringify(team)},
        );
    };

    regenerateTeamInviteId = (teamId: string) => {
        this.trackEvent('api', 'api_teams_regenerate_invite_id', {team_id: teamId});

        return this.doFetch<Team>(
            `${this.getTeamRoute(teamId)}/regenerate_invite_id`,
            {method: 'post'},
        );
    };

    updateTeamScheme = (teamId: string, schemeId: string) => {
        const patch = {scheme_id: schemeId};

        this.trackEvent('api', 'api_teams_update_scheme', {team_id: teamId, ...patch});

        return this.doFetch<StatusOK>(
            `${this.getTeamSchemeRoute(teamId)}`,
            {method: 'put', body: JSON.stringify(patch)},
        );
    };

    checkIfTeamExists = (teamName: string) => {
        return this.doFetch<{exists: boolean}>(
            `${this.getTeamNameRoute(teamName)}/exists`,
            {method: 'get'},
        );
    };

    getTeams = (page = 0, perPage = PER_PAGE_DEFAULT, includeTotalCount = false, excludePolicyConstrained = false) => {
        return this.doFetch<Team[] | TeamsWithCount>(
            `${this.getTeamsRoute()}${buildQueryString({page, per_page: perPage, include_total_count: includeTotalCount, exclude_policy_constrained: excludePolicyConstrained})}`,
            {method: 'get'},
        );
    };

    searchTeams = (term: string, opts: TeamSearchOpts) => {
        this.trackEvent('api', 'api_search_teams');

        return this.doFetch<Team[] | TeamsWithCount>(
            `${this.getTeamsRoute()}/search`,
            {method: 'post', body: JSON.stringify({term, ...opts})},
        );
    };

    getTeam = (teamId: string) => {
        return this.doFetch<Team>(
            this.getTeamRoute(teamId),
            {method: 'get'},
        );
    };

    getTeamByName = (teamName: string) => {
        this.trackEvent('api', 'api_teams_get_team_by_name');

        return this.doFetch<Team>(
            this.getTeamNameRoute(teamName),
            {method: 'get'},
        );
    };

    getMyTeams = () => {
        return this.doFetch<Team[]>(
            `${this.getUserRoute('me')}/teams`,
            {method: 'get'},
        );
    };

    getTeamsForUser = (userId: string) => {
        return this.doFetch<Team[]>(
            `${this.getUserRoute(userId)}/teams`,
            {method: 'get'},
        );
    };

    getMyTeamMembers = () => {
        return this.doFetch<TeamMembership[]>(
            `${this.getUserRoute('me')}/teams/members`,
            {method: 'get'},
        );
    };

    getMyTeamUnreads = (includeCollapsedThreads = false) => {
        return this.doFetch<TeamUnread[]>(
            `${this.getUserRoute('me')}/teams/unread${buildQueryString({include_collapsed_threads: includeCollapsedThreads})}`,
            {method: 'get'},
        );
    };

    getTeamMembers = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT, options: GetTeamMembersOpts) => {
        return this.doFetch<TeamMembership[]>(
            `${this.getTeamMembersRoute(teamId)}${buildQueryString({page, per_page: perPage, ...options})}`,
            {method: 'get'},
        );
    };

    getTeamMembersForUser = (userId: string) => {
        return this.doFetch<TeamMembership[]>(
            `${this.getUserRoute(userId)}/teams/members`,
            {method: 'get'},
        );
    };

    getTeamMember = (teamId: string, userId: string) => {
        return this.doFetch<TeamMembership>(
            `${this.getTeamMemberRoute(teamId, userId)}`,
            {method: 'get'},
        );
    };

    getTeamMembersByIds = (teamId: string, userIds: string[]) => {
        return this.doFetch<TeamMembership[]>(
            `${this.getTeamMembersRoute(teamId)}/ids`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    addToTeam = (teamId: string, userId: string) => {
        this.trackEvent('api', 'api_teams_invite_members', {team_id: teamId});

        const member = {user_id: userId, team_id: teamId};
        return this.doFetch<TeamMembership>(
            `${this.getTeamMembersRoute(teamId)}`,
            {method: 'post', body: JSON.stringify(member)},
        );
    };

    addToTeamFromInvite = (token = '', inviteId = '') => {
        this.trackEvent('api', 'api_teams_invite_members');

        const query = buildQueryString({token, invite_id: inviteId});
        return this.doFetch<TeamMembership>(
            `${this.getTeamsRoute()}/members/invite${query}`,
            {method: 'post'},
        );
    };

    addUsersToTeam = (teamId: string, userIds: string[]) => {
        this.trackEvent('api', 'api_teams_batch_add_members', {team_id: teamId, count: userIds.length});

        const members: any = [];
        userIds.forEach((id) => members.push({team_id: teamId, user_id: id}));
        return this.doFetch<TeamMembership[]>(
            `${this.getTeamMembersRoute(teamId)}/batch`,
            {method: 'post', body: JSON.stringify(members)},
        );
    };

    addUsersToTeamGracefully = (teamId: string, userIds: string[]) => {
        this.trackEvent('api', 'api_teams_batch_add_members', {team_id: teamId, count: userIds.length});

        const members: any = [];
        userIds.forEach((id) => members.push({team_id: teamId, user_id: id}));
        return this.doFetch<TeamMemberWithError[]>(
            `${this.getTeamMembersRoute(teamId)}/batch?graceful=true`,
            {method: 'post', body: JSON.stringify(members)},
        );
    };

    joinTeam = (inviteId: string) => {
        const query = buildQueryString({invite_id: inviteId});
        return this.doFetch<TeamMembership>(
            `${this.getTeamsRoute()}/members/invite${query}`,
            {method: 'post'},
        );
    };

    removeFromTeam = (teamId: string, userId: string) => {
        this.trackEvent('api', 'api_teams_remove_members', {team_id: teamId});

        return this.doFetch<StatusOK>(
            `${this.getTeamMemberRoute(teamId, userId)}`,
            {method: 'delete'},
        );
    };

    getTeamStats = (teamId: string) => {
        return this.doFetch<TeamStats>(
            `${this.getTeamRoute(teamId)}/stats`,
            {method: 'get'},
        );
    };

    getTotalUsersStats = () => {
        return this.doFetch<UsersStats>(
            `${this.getUsersRoute()}/stats`,
            {method: 'get'},
        );
    };

    getFilteredUsersStats = (options: GetFilteredUsersStatsOpts) => {
        return this.doFetch<UsersStats>(
            `${this.getUsersRoute()}/stats/filtered${buildQueryString(options)}`,
            {method: 'get'},
        );
    };

    invalidateAllEmailInvites = () => {
        return this.doFetch<StatusOK>(
            `${this.getTeamsRoute()}/invites/email`,
            {method: 'delete'},
        );
    };

    getTeamInviteInfo = (inviteId: string) => {
        return this.doFetch<{
            display_name: string;
            description: string;
            name: string;
            id: string;
        }>(
            `${this.getTeamsRoute()}/invite/${inviteId}`,
            {method: 'get'},
        );
    };

    updateTeamMemberRoles = (teamId: string, userId: string, roles: string[]) => {
        this.trackEvent('api', 'api_teams_update_member_roles', {team_id: teamId});

        return this.doFetch<StatusOK>(
            `${this.getTeamMemberRoute(teamId, userId)}/roles`,
            {method: 'put', body: JSON.stringify({roles})},
        );
    };

    sendEmailInvitesToTeam = (teamId: string, emails: string[]) => {
        this.trackEvent('api', 'api_teams_invite_members', {team_id: teamId});

        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}/invite/email`,
            {method: 'post', body: JSON.stringify(emails)},
        );
    };

    sendEmailGuestInvitesToChannels = (teamId: string, channelIds: string[], emails: string[], message: string) => {
        this.trackEvent('api', 'api_teams_invite_guests', {team_id: teamId, channel_ids: channelIds});

        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}/invite-guests/email`,
            {method: 'post', body: JSON.stringify({emails, channels: channelIds, message})},
        );
    };

    sendEmailInvitesToTeamGracefully = (teamId: string, emails: string[]) => {
        this.trackEvent('api', 'api_teams_invite_members', {team_id: teamId});

        return this.doFetch<TeamInviteWithError>(
            `${this.getTeamRoute(teamId)}/invite/email?graceful=true`,
            {method: 'post', body: JSON.stringify(emails)},
        );
    };

    sendEmailInvitesToTeamAndChannelsGracefully = (
        teamId: string,
        channelIds: string[],
        emails: string[],
        message: string,
    ) => {
        this.trackEvent('api', 'api_teams_invite_members_to_channels', {team_id: teamId, channel_len: channelIds.length});

        return this.doFetch<TeamInviteWithError>(
            `${this.getTeamRoute(teamId)}/invite/email?graceful=true`,
            {method: 'post', body: JSON.stringify({emails, channelIds, message})},
        );
    };

    sendEmailGuestInvitesToChannelsGracefully = async (teamId: string, channelIds: string[], emails: string[], message: string) => {
        this.trackEvent('api', 'api_teams_invite_guests', {team_id: teamId, channel_ids: channelIds});

        return this.doFetch<TeamInviteWithError>(
            `${this.getTeamRoute(teamId)}/invite-guests/email?graceful=true`,
            {method: 'post', body: JSON.stringify({emails, channels: channelIds, message})},
        );
    };

    getTeamIconUrl = (teamId: string, lastTeamIconUpdate: number) => {
        const params: any = {};
        if (lastTeamIconUpdate) {
            params._ = lastTeamIconUpdate;
        }

        return `${this.getTeamRoute(teamId)}/image${buildQueryString(params)}`;
    };

    setTeamIcon = (teamId: string, imageData: File) => {
        this.trackEvent('api', 'api_team_set_team_icon');

        const formData = new FormData();
        formData.append('image', imageData);

        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}/image`,
            request,
        );
    };

    removeTeamIcon = (teamId: string) => {
        this.trackEvent('api', 'api_team_remove_team_icon');

        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}/image`,
            {method: 'delete'},
        );
    };

    updateTeamMemberSchemeRoles = (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => {
        const body = {scheme_user: isSchemeUser, scheme_admin: isSchemeAdmin};
        return this.doFetch<StatusOK>(
            `${this.getTeamRoute(teamId)}/members/${userId}/schemeRoles`,
            {method: 'put', body: JSON.stringify(body)},
        );
    };

    // Channel Routes

    getAllChannels = (page = 0, perPage = PER_PAGE_DEFAULT, notAssociatedToGroup = '', excludeDefaultChannels = false, includeTotalCount = false, includeDeleted = false, excludePolicyConstrained = false) => {
        const queryData = {
            page,
            per_page: perPage,
            not_associated_to_group: notAssociatedToGroup,
            exclude_default_channels: excludeDefaultChannels,
            include_total_count: includeTotalCount,
            include_deleted: includeDeleted,
            exclude_policy_constrained: excludePolicyConstrained,
        };
        return this.doFetch<ChannelWithTeamData[] | ChannelsWithTotalCount>(
            `${this.getChannelsRoute()}${buildQueryString(queryData)}`,
            {method: 'get'},
        );
    };

    createChannel = (channel: Channel) => {
        this.trackEvent('api', 'api_channels_create', {team_id: channel.team_id});

        return this.doFetch<ServerChannel>(
            `${this.getChannelsRoute()}`,
            {method: 'post', body: JSON.stringify(channel)},
        );
    };

    createDirectChannel = (userIds: string[]) => {
        this.trackEvent('api', 'api_channels_create_direct');

        return this.doFetch<ServerChannel>(
            `${this.getChannelsRoute()}/direct`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    createGroupChannel = (userIds: string[]) => {
        this.trackEvent('api', 'api_channels_create_group');

        return this.doFetch<ServerChannel>(
            `${this.getChannelsRoute()}/group`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    deleteChannel = (channelId: string) => {
        this.trackEvent('api', 'api_channels_delete', {channel_id: channelId});

        return this.doFetch<StatusOK>(
            `${this.getChannelRoute(channelId)}`,
            {method: 'delete'},
        );
    };

    unarchiveChannel = (channelId: string) => {
        this.trackEvent('api', 'api_channels_unarchive', {channel_id: channelId});

        return this.doFetch<ServerChannel>(
            `${this.getChannelRoute(channelId)}/restore`,
            {method: 'post'},
        );
    };

    updateChannel = (channel: Channel) => {
        this.trackEvent('api', 'api_channels_update', {channel_id: channel.id});

        return this.doFetch<ServerChannel>(
            `${this.getChannelRoute(channel.id)}`,
            {method: 'put', body: JSON.stringify(channel)},
        );
    };

    updateChannelPrivacy = (channelId: string, privacy: any) => {
        this.trackEvent('api', 'api_channels_update_privacy', {channel_id: channelId, privacy});

        return this.doFetch<ServerChannel>(
            `${this.getChannelRoute(channelId)}/privacy`,
            {method: 'put', body: JSON.stringify({privacy})},
        );
    };

    patchChannel = (channelId: string, channelPatch: Partial<Channel>) => {
        this.trackEvent('api', 'api_channels_patch', {channel_id: channelId});

        return this.doFetch<ServerChannel>(
            `${this.getChannelRoute(channelId)}/patch`,
            {method: 'put', body: JSON.stringify(channelPatch)},
        );
    };

    updateChannelNotifyProps = (props: any) => {
        this.trackEvent('api', 'api_users_update_channel_notifications', {channel_id: props.channel_id});

        return this.doFetch<StatusOK>(
            `${this.getChannelMemberRoute(props.channel_id, props.user_id)}/notify_props`,
            {method: 'put', body: JSON.stringify(props)},
        );
    };

    updateChannelScheme = (channelId: string, schemeId: string) => {
        const patch = {scheme_id: schemeId};

        this.trackEvent('api', 'api_channels_update_scheme', {channel_id: channelId, ...patch});

        return this.doFetch<StatusOK>(
            `${this.getChannelSchemeRoute(channelId)}`,
            {method: 'put', body: JSON.stringify(patch)},
        );
    };

    getChannel = (channelId: string) => {
        return this.doFetch<ServerChannel>(
            `${this.getChannelRoute(channelId)}`,
            {method: 'get'},
        );
    };

    getChannelByName = (teamId: string, channelName: string, includeDeleted = false) => {
        return this.doFetch<ServerChannel>(
            `${this.getTeamRoute(teamId)}/channels/name/${channelName}?include_deleted=${includeDeleted}`,
            {method: 'get'},
        );
    };

    getChannelByNameAndTeamName = (teamName: string, channelName: string, includeDeleted = false) => {
        return this.doFetch<ServerChannel>(
            `${this.getTeamNameRoute(teamName)}/channels/name/${channelName}?include_deleted=${includeDeleted}`,
            {method: 'get'},
        );
    };

    getChannels = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<ServerChannel[]>(
            `${this.getTeamRoute(teamId)}/channels${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    getAllTeamsChannels = () => {
        return this.doFetch<ServerChannel[]>(
            `${this.getUsersRoute()}/me/channels`,
            {method: 'get'},
        );
    };

    getArchivedChannels = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<ServerChannel[]>(
            `${this.getTeamRoute(teamId)}/channels/deleted${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getMyChannels = (teamId: string, includeDeleted = false) => {
        return this.doFetch<ServerChannel[]>(
            `${this.getUserRoute('me')}/teams/${teamId}/channels${buildQueryString({include_deleted: includeDeleted})}`,
            {method: 'get'},
        );
    };

    getAllChannelsMembers = (userId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<ChannelMembership[]>(
            `${this.getUserRoute(userId)}/channel_members${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getMyChannelMember = (channelId: string) => {
        return this.doFetch<ChannelMembership>(
            `${this.getChannelMemberRoute(channelId, 'me')}`,
            {method: 'get'},
        );
    };

    getMyChannelMembers = (teamId: string) => {
        return this.doFetch<ChannelMembership[]>(
            `${this.getUserRoute('me')}/teams/${teamId}/channels/members`,
            {method: 'get'},
        );
    };

    getChannelMembers = (channelId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<ChannelMembership[]>(
            `${this.getChannelMembersRoute(channelId)}${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getChannelTimezones = (channelId: string) => {
        return this.doFetch<string[]>(
            `${this.getChannelRoute(channelId)}/timezones`,
            {method: 'get'},
        );
    };

    getChannelMember = (channelId: string, userId: string) => {
        return this.doFetch<ChannelMembership>(
            `${this.getChannelMemberRoute(channelId, userId)}`,
            {method: 'get'},
        );
    };

    getChannelMembersByIds = (channelId: string, userIds: string[]) => {
        return this.doFetch<ChannelMembership[]>(
            `${this.getChannelMembersRoute(channelId)}/ids`,
            {method: 'post', body: JSON.stringify(userIds)},
        );
    };

    addToChannel = (userId: string, channelId: string, postRootId = '') => {
        this.trackEvent('api', 'api_channels_add_member', {channel_id: channelId});

        const member = {user_id: userId, channel_id: channelId, post_root_id: postRootId};
        return this.doFetch<ChannelMembership>(
            `${this.getChannelMembersRoute(channelId)}`,
            {method: 'post', body: JSON.stringify(member)},
        );
    };

    removeFromChannel = (userId: string, channelId: string) => {
        this.trackEvent('api', 'api_channels_remove_member', {channel_id: channelId});

        return this.doFetch<StatusOK>(
            `${this.getChannelMemberRoute(channelId, userId)}`,
            {method: 'delete'},
        );
    };

    updateChannelMemberRoles = (channelId: string, userId: string, roles: string) => {
        return this.doFetch<StatusOK>(
            `${this.getChannelMemberRoute(channelId, userId)}/roles`,
            {method: 'put', body: JSON.stringify({roles})},
        );
    };

    getChannelStats = (channelId: string, includeFileCount = false) => {
        const param = !includeFileCount ? '?exclude_files_count=true' : '';
        return this.doFetch<ChannelStats>(
            `${this.getChannelRoute(channelId)}/stats${param}`,
            {method: 'get'},
        );
    };

    getChannelsMemberCount = (channelIds: string[]) => {
        return this.doFetch<Record<string, number>>(
            `${this.getChannelsRoute()}/stats/member_count`,
            {method: 'post', body: JSON.stringify(channelIds)}
        )
    }

    getChannelModerations = (channelId: string) => {
        return this.doFetch<ChannelModeration[]>(
            `${this.getChannelRoute(channelId)}/moderations`,
            {method: 'get'},
        );
    };

    patchChannelModerations = (channelId: string, channelModerationsPatch: ChannelModerationPatch[]) => {
        return this.doFetch<ChannelModeration[]>(
            `${this.getChannelRoute(channelId)}/moderations/patch`,
            {method: 'put', body: JSON.stringify(channelModerationsPatch)},
        );
    };

    getChannelMemberCountsByGroup = (channelId: string, includeTimezones: boolean) => {
        return this.doFetch<ChannelMemberCountsByGroup>(
            `${this.getChannelRoute(channelId)}/member_counts_by_group?include_timezones=${includeTimezones}`,
            {method: 'get'},
        );
    };

    viewMyChannel = (channelId: string, prevChannelId?: string) => {
        const data = {channel_id: channelId, prev_channel_id: prevChannelId, collapsed_threads_supported: true};
        return this.doFetch<ChannelViewResponse>(
            `${this.getChannelsRoute()}/members/me/view`,
            {method: 'post', body: JSON.stringify(data)},
        );
    };

    autocompleteChannels = (teamId: string, name: string) => {
        return this.doFetch<Channel[]>(
            `${this.getTeamRoute(teamId)}/channels/autocomplete${buildQueryString({name})}`,
            {method: 'get'},
        );
    };

    autocompleteChannelsForSearch = (teamId: string, name: string) => {
        return this.doFetch<Channel[]>(
            `${this.getTeamRoute(teamId)}/channels/search_autocomplete${buildQueryString({name})}`,
            {method: 'get'},
        );
    };

    searchChannels = (teamId: string, term: string) => {
        return this.doFetch<Channel[]>(
            `${this.getTeamRoute(teamId)}/channels/search`,
            {method: 'post', body: JSON.stringify({term})},
        );
    };

    searchArchivedChannels = (teamId: string, term: string) => {
        return this.doFetch<Channel[]>(
            `${this.getTeamRoute(teamId)}/channels/search_archived`,
            {method: 'post', body: JSON.stringify({term})},
        );
    };

    searchAllChannels = (term: string, opts: ChannelSearchOpts = {}) => {
        const body = {
            term,
            ...opts,
        };
        const includeDeleted = Boolean(opts.include_deleted);
        const nonAdminSearch = Boolean(opts.nonAdminSearch);
        let queryParams: {include_deleted?: boolean; system_console?: boolean} = {include_deleted: includeDeleted};
        if (nonAdminSearch) {
            queryParams = {system_console: false};
            delete body.nonAdminSearch;
        }
        return this.doFetch<Channel[] | ChannelsWithTotalCount>(
            `${this.getChannelsRoute()}/search${buildQueryString(queryParams)}`,
            {method: 'post', body: JSON.stringify(body)},
        );
    };

    searchGroupChannels = (term: string) => {
        return this.doFetch<Channel[]>(
            `${this.getChannelsRoute()}/group/search`,
            {method: 'post', body: JSON.stringify({term})},
        );
    };

    updateChannelMemberSchemeRoles = (channelId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => {
        const body = {scheme_user: isSchemeUser, scheme_admin: isSchemeAdmin};
        return this.doFetch<StatusOK>(
            `${this.getChannelRoute(channelId)}/members/${userId}/schemeRoles`,
            {method: 'put', body: JSON.stringify(body)},
        );
    };

    // Channel Category Routes

    getChannelCategories = (userId: string, teamId: string) => {
        return this.doFetch<OrderedChannelCategories>(
            `${this.getChannelCategoriesRoute(userId, teamId)}`,
            {method: 'get'},
        );
    };

    createChannelCategory = (userId: string, teamId: string, category: Partial<ChannelCategory>) => {
        return this.doFetch<ChannelCategory>(
            `${this.getChannelCategoriesRoute(userId, teamId)}`,
            {method: 'post', body: JSON.stringify(category)},
        );
    };

    updateChannelCategories = (userId: string, teamId: string, categories: ChannelCategory[]) => {
        return this.doFetch<ChannelCategory[]>(
            `${this.getChannelCategoriesRoute(userId, teamId)}`,
            {method: 'put', body: JSON.stringify(categories)},
        );
    };

    getChannelCategoryOrder = (userId: string, teamId: string) => {
        return this.doFetch<string[]>(
            `${this.getChannelCategoriesRoute(userId, teamId)}/order`,
            {method: 'get'},
        );
    };

    updateChannelCategoryOrder = (userId: string, teamId: string, categoryOrder: string[]) => {
        return this.doFetch<string[]>(
            `${this.getChannelCategoriesRoute(userId, teamId)}/order`,
            {method: 'put', body: JSON.stringify(categoryOrder)},
        );
    };

    getChannelCategory = (userId: string, teamId: string, categoryId: string) => {
        return this.doFetch<ChannelCategory>(
            `${this.getChannelCategoriesRoute(userId, teamId)}/${categoryId}`,
            {method: 'get'},
        );
    };

    updateChannelCategory = (userId: string, teamId: string, category: ChannelCategory) => {
        return this.doFetch<ChannelCategory>(
            `${this.getChannelCategoriesRoute(userId, teamId)}/${category.id}`,
            {method: 'put', body: JSON.stringify(category)},
        );
    };

    deleteChannelCategory = (userId: string, teamId: string, categoryId: string) => {
        return this.doFetch<ChannelCategory>(
            `${this.getChannelCategoriesRoute(userId, teamId)}/${categoryId}`,
            {method: 'delete'},
        );
    }

    // Post Routes

    createPost = async (post: Post) => {
        const result = await this.doFetch<Post>(
            `${this.getPostsRoute()}`,
            {method: 'post', body: JSON.stringify(post)},
        );
        const analyticsData = {channel_id: result.channel_id, post_id: result.id, user_actual_id: result.user_id, root_id: result.root_id} as PostAnalytics;
        if (post.metadata?.priority) {
            analyticsData.priority = post.metadata.priority.priority;
            analyticsData.requested_ack = post.metadata.priority.requested_ack;
            analyticsData.persistent_notifications = post.metadata.priority.persistent_notifications;
        }

        this.trackEvent('api', 'api_posts_create', analyticsData);

        if (result.root_id != null && result.root_id !== '') {
            this.trackEvent('api', 'api_posts_replied', analyticsData);
        }
        return result;
    };

    updatePost = (post: Post) => {
        this.trackEvent('api', 'api_posts_update', {channel_id: post.channel_id, post_id: post.id});

        return this.doFetch<Post>(
            `${this.getPostRoute(post.id)}`,
            {method: 'put', body: JSON.stringify(post)},
        );
    };

    getPost = (postId: string) => {
        return this.doFetch<Post>(
            `${this.getPostRoute(postId)}`,
            {method: 'get'},
        );
    };

    patchPost = (postPatch: Partial<Post> & {id: string}) => {
        this.trackEvent('api', 'api_posts_patch', {channel_id: postPatch.channel_id, post_id: postPatch.id});

        return this.doFetch<Post>(
            `${this.getPostRoute(postPatch.id)}/patch`,
            {method: 'put', body: JSON.stringify(postPatch)},
        );
    };

    deletePost = (postId: string) => {
        this.trackEvent('api', 'api_posts_delete');

        return this.doFetch<StatusOK>(
            `${this.getPostRoute(postId)}`,
            {method: 'delete'},
        );
    };

    getPostThread = (postId: string, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        // this is to ensure we have backwards compatibility for `getPostThread`
        return this.getPaginatedPostThread(postId, {fetchThreads, collapsedThreads, collapsedThreadsExtended});
    };

    getPaginatedPostThread = async (postId: string, options: FetchPaginatedThreadOptions): Promise<PaginatedPostList> => {
        // getting all option parameters with defaults from the options object and spread the rest
        const {
            fetchThreads = true,
            collapsedThreads = false,
            collapsedThreadsExtended = false,
            direction = 'down',
            fetchAll = false,
            perPage = fetchAll ? undefined : PER_PAGE_DEFAULT,
            ...rest
        } = options;

        return this.doFetch<PaginatedPostList>(
            `${this.getPostRoute(postId)}/thread${buildQueryString({skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended, direction, perPage, ...rest})}`,
            {method: 'get'},
        );
    };

    getPosts = (channelId: string, page = 0, perPage = PER_PAGE_DEFAULT, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        return this.doFetch<PostList>(
            `${this.getChannelRoute(channelId)}/posts${buildQueryString({page, per_page: perPage, skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended})}`,
            {method: 'get'},
        );
    };

    getPostsUnread = (channelId: string, userId: string, limitAfter = DEFAULT_LIMIT_AFTER, limitBefore = DEFAULT_LIMIT_BEFORE, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        return this.doFetch<PostList>(
            `${this.getUserRoute(userId)}/channels/${channelId}/posts/unread${buildQueryString({limit_after: limitAfter, limit_before: limitBefore, skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended})}`,
            {method: 'get'},
        );
    };

    getPostsSince = (channelId: string, since: number, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        return this.doFetch<PostList>(
            `${this.getChannelRoute(channelId)}/posts${buildQueryString({since, skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended})}`,
            {method: 'get'},
        );
    };

    getPostsBefore = (channelId: string, postId: string, page = 0, perPage = PER_PAGE_DEFAULT, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        return this.doFetch<PostList>(
            `${this.getChannelRoute(channelId)}/posts${buildQueryString({before: postId, page, per_page: perPage, skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended})}`,
            {method: 'get'},
        );
    };

    getPostsAfter = (channelId: string, postId: string, page = 0, perPage = PER_PAGE_DEFAULT, fetchThreads = true, collapsedThreads = false, collapsedThreadsExtended = false) => {
        return this.doFetch<PostList>(
            `${this.getChannelRoute(channelId)}/posts${buildQueryString({after: postId, page, per_page: perPage, skipFetchThreads: !fetchThreads, collapsedThreads, collapsedThreadsExtended})}`,
            {method: 'get'},
        );
    };

    getUserThreads = (
        userId: UserProfile['id'] = 'me',
        teamId: Team['id'],
        {
            before = '',
            after = '',
            perPage = PER_PAGE_DEFAULT,
            extended = false,
            deleted = false,
            unread = false,
            since = 0,
            totalsOnly = false,
            threadsOnly = false,
        },
    ) => {
        return this.doFetch<UserThreadList>(
            `${this.getUserThreadsRoute(userId, teamId)}${buildQueryString({before, after, per_page: perPage, extended, deleted, unread, since, totalsOnly, threadsOnly})}`,
            {method: 'get'},
        );
    };

    getUserThread = (userId: string, teamId: string, threadId: string, extended = false) => {
        const url = `${this.getUserThreadRoute(userId, teamId, threadId)}`;
        return this.doFetch<UserThreadWithPost>(
            `${url}${buildQueryString({extended})}`,
            {method: 'get'},
        );
    };

    updateThreadsReadForUser = (userId: string, teamId: string) => {
        const url = `${this.getUserThreadsRoute(userId, teamId)}/read`;
        return this.doFetch<StatusOK>(
            url,
            {method: 'put'},
        );
    };

    updateThreadReadForUser = (userId: string, teamId: string, threadId: string, timestamp: number) => {
        const url = `${this.getUserThreadRoute(userId, teamId, threadId)}/read/${timestamp}`;
        return this.doFetch<UserThread>(
            url,
            {method: 'put'},
        );
    };

    markThreadAsUnreadForUser = (userId: string, teamId: string, threadId: string, postId: string) => {
        const url = `${this.getUserThreadRoute(userId, teamId, threadId)}/set_unread/${postId}`;
        return this.doFetch<UserThread>(
            url,
            {method: 'post'},
        );
    };

    updateThreadFollowForUser = (userId: string, teamId: string, threadId: string, state: boolean) => {
        const url = this.getUserThreadRoute(userId, teamId, threadId) + '/following';
        return this.doFetch<StatusOK>(
            url,
            {method: state ? 'put' : 'delete'},
        );
    };

    getFileInfosForPost = (postId: string) => {
        return this.doFetch<FileInfo[]>(
            `${this.getPostRoute(postId)}/files/info`,
            {method: 'get'},
        );
    };

    getFlaggedPosts = (userId: string, channelId = '', teamId = '', page = 0, perPage = PER_PAGE_DEFAULT) => {
        this.trackEvent('api', 'api_posts_get_flagged', {team_id: teamId});

        return this.doFetch<PostList>(
            `${this.getUserRoute(userId)}/posts/flagged${buildQueryString({channel_id: channelId, team_id: teamId, page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getPinnedPosts = (channelId: string) => {
        this.trackEvent('api', 'api_posts_get_pinned', {channel_id: channelId});
        return this.doFetch<PostList>(
            `${this.getChannelRoute(channelId)}/pinned`,
            {method: 'get'},
        );
    };

    markPostAsUnread = (userId: string, postId: string) => {
        this.trackEvent('api', 'api_post_set_unread_post');

        return this.doFetch<ChannelUnread>(
            `${this.getUserRoute(userId)}/posts/${postId}/set_unread`,
            {method: 'post', body: JSON.stringify({collapsed_threads_supported: true})},
        );
    }

    addPostReminder = (userId: string, postId: string, timestamp: number) => {
        this.trackEvent('api', 'api_post_set_reminder');

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/posts/${postId}/reminder`,
            {method: 'post', body: JSON.stringify({target_time: timestamp})},
        );
    }

    pinPost = (postId: string) => {
        this.trackEvent('api', 'api_posts_pin');

        return this.doFetch<StatusOK>(
            `${this.getPostRoute(postId)}/pin`,
            {method: 'post'},
        );
    };

    unpinPost = (postId: string) => {
        this.trackEvent('api', 'api_posts_unpin');

        return this.doFetch<StatusOK>(
            `${this.getPostRoute(postId)}/unpin`,
            {method: 'post'},
        );
    };

    getPostsByIds = (postIds: string[]) => {
        return this.doFetch<Post[]>(
            `${this.getPostsRoute()}/ids`,
            {method: 'post', body: JSON.stringify(postIds)},
        );
    };

    getPostEditHistory = (postId: string) => {
        return this.doFetch<Post[]>(
            `${this.getPostRoute(postId)}/edit_history`,
            {method: 'get'},
        );
    }

    addReaction = (userId: string, postId: string, emojiName: string) => {
        this.trackEvent('api', 'api_reactions_save', {post_id: postId});

        return this.doFetch<Reaction>(
            `${this.getReactionsRoute()}`,
            {method: 'post', body: JSON.stringify({user_id: userId, post_id: postId, emoji_name: emojiName})},
        );
    };

    removeReaction = (userId: string, postId: string, emojiName: string) => {
        this.trackEvent('api', 'api_reactions_delete', {post_id: postId});

        return this.doFetch<StatusOK>(
            `${this.getUserRoute(userId)}/posts/${postId}/reactions/${emojiName}`,
            {method: 'delete'},
        );
    };

    getReactionsForPost = (postId: string) => {
        return this.doFetch<Reaction[]>(
            `${this.getPostRoute(postId)}/reactions`,
            {method: 'get'},
        );
    };

    searchPostsWithParams = (teamId: string, params: any) => {
        this.trackEvent('api', 'api_posts_search', {team_id: teamId});

        let route = `${this.getPostsRoute()}/search`;
        if (teamId) {
            route = `${this.getTeamRoute(teamId)}/posts/search`;
        }

        return this.doFetch<PostSearchResults>(
            route,
            {method: 'post', body: JSON.stringify(params)},
        );
    };

    searchPosts = (teamId: string, terms: string, isOrSearch: boolean) => {
        return this.searchPostsWithParams(teamId, {terms, is_or_search: isOrSearch});
    };

    searchFilesWithParams = (teamId: string, params: any) => {
        this.trackEvent('api', 'api_files_search', {team_id: teamId});

        return this.doFetch<FileSearchResults>(
            `${this.getTeamRoute(teamId)}/files/search`,
            {method: 'post', body: JSON.stringify(params)},
        );
    };

    searchFiles = (teamId: string, terms: string, isOrSearch: boolean) => {
        return this.searchFilesWithParams(teamId, {terms, is_or_search: isOrSearch});
    };

    getOpenGraphMetadata = (url: string) => {
        return this.doFetch<OpenGraphMetadata>(
            `${this.getBaseRoute()}/opengraph`,
            {method: 'post', body: JSON.stringify({url})},
        );
    };

    doPostAction = (postId: string, actionId: string, selectedOption = '') => {
        return this.doPostActionWithCookie(postId, actionId, '', selectedOption);
    };

    doPostActionWithCookie = (postId: string, actionId: string, actionCookie: string, selectedOption = '') => {
        if (selectedOption) {
            this.trackEvent('api', 'api_interactive_messages_menu_selected');
        } else {
            this.trackEvent('api', 'api_interactive_messages_button_clicked');
        }

        const msg: any = {
            selected_option: selectedOption,
        };
        if (actionCookie !== '') {
            msg.cookie = actionCookie;
        }
        return this.doFetch<PostActionResponse>(
            `${this.getPostRoute(postId)}/actions/${encodeURIComponent(actionId)}`,
            {method: 'post', body: JSON.stringify(msg)},
        );
    };

    // Files Routes

    getFileUrl(fileId: string, timestamp: number) {
        let url = `${this.getFileRoute(fileId)}`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    getFileThumbnailUrl(fileId: string, timestamp: number) {
        let url = `${this.getFileRoute(fileId)}/thumbnail`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    getFilePreviewUrl(fileId: string, timestamp: number) {
        let url = `${this.getFileRoute(fileId)}/preview`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    uploadFile = (fileFormData: any) => {
        this.trackEvent('api', 'api_files_upload');
        const request: any = {
            method: 'post',
            body: fileFormData,
        };

        return this.doFetch<FileUploadResponse>(
            `${this.getFilesRoute()}`,
            request,
        );
    };

    getFilePublicLink = (fileId: string) => {
        return this.doFetch<{
            link: string;
        }>(
            `${this.getFileRoute(fileId)}/link`,
            {method: 'get'},
        );
    }

    acknowledgePost = (postId: string, userId: string) => {
        this.trackEvent('api', 'api_posts_ack');

        return this.doFetch<PostAcknowledgement>(
            `${this.getUserRoute(userId)}/posts/${postId}/ack`,
            {method: 'post'},
        );
    };

    unacknowledgePost = (postId: string, userId: string) => {
        this.trackEvent('api', 'api_posts_unack');

        return this.doFetch<null>(
            `${this.getUserRoute(userId)}/posts/${postId}/ack`,
            {method: 'delete'},
        );
    };

    // Preference Routes

    savePreferences = (userId: string, preferences: PreferenceType[]) => {
        return this.doFetch<StatusOK>(
            `${this.getPreferencesRoute(userId)}`,
            {method: 'put', body: JSON.stringify(preferences)},
        );
    };

    getMyPreferences = () => {
        return this.doFetch<PreferenceType>(
            `${this.getPreferencesRoute('me')}`,
            {method: 'get'},
        );
    };

    deletePreferences = (userId: string, preferences: PreferenceType[]) => {
        return this.doFetch<StatusOK>(
            `${this.getPreferencesRoute(userId)}/delete`,
            {method: 'post', body: JSON.stringify(preferences)},
        );
    };

    // General Routes

    ping = () => {
        return this.doFetch<{
            status: string;
            ActiveSearchBackend: string;
        }>(
            `${this.getBaseRoute()}/system/ping?time=${Date.now()}`,
            {method: 'get'},
        );
    };

    upgradeToEnterprise = async () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/upgrade_to_enterprise`,
            {method: 'post'},
        );
    }

    upgradeToEnterpriseStatus = async () => {
        return this.doFetch<{
            percentage: number;
            error: string | null;
        }>(
            `${this.getBaseRoute()}/upgrade_to_enterprise/status`,
            {method: 'get'},
        );
    }

    restartServer = async () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/restart`,
            {method: 'post'},
        );
    }

    logClientError = (message: string, level = LogLevel.Error) => {
        const url = `${this.getBaseRoute()}/logs`;

        if (!this.enableLogging) {
            throw new ClientError(this.getUrl(), {
                message: 'Logging disabled.',
                url,
            });
        }

        return this.doFetch<{
            message: string;
        }>(
            url,
            {method: 'post', body: JSON.stringify({message, level})},
        );
    };

    getClientConfigOld = () => {
        return this.doFetch<ClientConfig>(
            `${this.getBaseRoute()}/config/client?format=old`,
            {method: 'get'},
        );
    };

    getClientLicenseOld = () => {
        return this.doFetch<ClientLicense>(
            `${this.getBaseRoute()}/license/client?format=old`,
            {method: 'get'},
        );
    };

    getWarnMetricsStatus = async () => {
        return this.doFetch(
            `${this.getBaseRoute()}/warn_metrics/status`,
            {method: 'get'},
        );
    };

    sendWarnMetricAck = async (warnMetricId: string, forceAckVal: boolean) => {
        return this.doFetch(
            `${this.getBaseRoute()}/warn_metrics/ack/${encodeURI(warnMetricId)}`,
            {method: 'post', body: JSON.stringify({forceAck: forceAckVal})},
        );
    }

    setFirstAdminVisitMarketplaceStatus = async () => {
        return this.doFetch<StatusOK>(
            `${this.getPluginsRoute()}/marketplace/first_admin_visit`,
            {method: 'post', body: JSON.stringify({first_admin_visit_marketplace_status: true})},
        );
    }

    getFirstAdminVisitMarketplaceStatus = async () => {
        return this.doFetch<SystemSetting>(
            `${this.getPluginsRoute()}/marketplace/first_admin_visit`,
            {method: 'get'},
        );
    };

    getFirstAdminSetupComplete = async () => {
        return this.doFetch<SystemSetting>(
            `${this.getSystemRoute()}/onboarding/complete`,
            {method: 'get'},
        );
    };

    getTranslations = (url: string) => {
        return this.doFetch<Record<string, string>>(
            url,
            {method: 'get'},
        );
    };

    getWebSocketUrl = () => {
        return `${this.getBaseRoute()}/websocket`;
    }

    // Integration Routes

    createIncomingWebhook = (hook: IncomingWebhook) => {
        this.trackEvent('api', 'api_integrations_created', {team_id: hook.team_id});

        return this.doFetch<IncomingWebhook>(
            `${this.getIncomingHooksRoute()}`,
            {method: 'post', body: JSON.stringify(hook)},
        );
    };

    getIncomingWebhook = (hookId: string) => {
        return this.doFetch<IncomingWebhook>(
            `${this.getIncomingHookRoute(hookId)}`,
            {method: 'get'},
        );
    };

    getIncomingWebhooks = (teamId = '', page = 0, perPage = PER_PAGE_DEFAULT) => {
        const queryParams: any = {
            page,
            per_page: perPage,
        };

        if (teamId) {
            queryParams.team_id = teamId;
        }

        return this.doFetch<IncomingWebhook[]>(
            `${this.getIncomingHooksRoute()}${buildQueryString(queryParams)}`,
            {method: 'get'},
        );
    };

    removeIncomingWebhook = (hookId: string) => {
        this.trackEvent('api', 'api_integrations_deleted');

        return this.doFetch<StatusOK>(
            `${this.getIncomingHookRoute(hookId)}`,
            {method: 'delete'},
        );
    };

    updateIncomingWebhook = (hook: IncomingWebhook) => {
        this.trackEvent('api', 'api_integrations_updated', {team_id: hook.team_id});

        return this.doFetch<IncomingWebhook>(
            `${this.getIncomingHookRoute(hook.id)}`,
            {method: 'put', body: JSON.stringify(hook)},
        );
    };

    createOutgoingWebhook = (hook: OutgoingWebhook) => {
        this.trackEvent('api', 'api_integrations_created', {team_id: hook.team_id});

        return this.doFetch<OutgoingWebhook>(
            `${this.getOutgoingHooksRoute()}`,
            {method: 'post', body: JSON.stringify(hook)},
        );
    };

    getOutgoingWebhook = (hookId: string) => {
        return this.doFetch<OutgoingWebhook>(
            `${this.getOutgoingHookRoute(hookId)}`,
            {method: 'get'},
        );
    };

    getOutgoingWebhooks = (channelId = '', teamId = '', page = 0, perPage = PER_PAGE_DEFAULT) => {
        const queryParams: any = {
            page,
            per_page: perPage,
        };

        if (channelId) {
            queryParams.channel_id = channelId;
        }

        if (teamId) {
            queryParams.team_id = teamId;
        }

        return this.doFetch<OutgoingWebhook[]>(
            `${this.getOutgoingHooksRoute()}${buildQueryString(queryParams)}`,
            {method: 'get'},
        );
    };

    removeOutgoingWebhook = (hookId: string) => {
        this.trackEvent('api', 'api_integrations_deleted');

        return this.doFetch<StatusOK>(
            `${this.getOutgoingHookRoute(hookId)}`,
            {method: 'delete'},
        );
    };

    updateOutgoingWebhook = (hook: OutgoingWebhook) => {
        this.trackEvent('api', 'api_integrations_updated', {team_id: hook.team_id});

        return this.doFetch<OutgoingWebhook>(
            `${this.getOutgoingHookRoute(hook.id)}`,
            {method: 'put', body: JSON.stringify(hook)},
        );
    };

    regenOutgoingHookToken = (id: string) => {
        return this.doFetch<OutgoingWebhook>(
            `${this.getOutgoingHookRoute(id)}/regen_token`,
            {method: 'post'},
        );
    };

    getCommandsList = (teamId: string) => {
        return this.doFetch<Command[]>(
            `${this.getCommandsRoute()}?team_id=${teamId}`,
            {method: 'get'},
        );
    };

    getCommandAutocompleteSuggestionsList = (userInput: string, teamId: string, commandArgs: CommandArgs) => {
        return this.doFetch<AutocompleteSuggestion[]>(
            `${this.getTeamRoute(teamId)}/commands/autocomplete_suggestions${buildQueryString({...commandArgs, user_input: userInput})}`,
            {method: 'get'},
        );
    };

    getAutocompleteCommandsList = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Command[]>(
            `${this.getTeamRoute(teamId)}/commands/autocomplete${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getCustomTeamCommands = (teamId: string) => {
        return this.doFetch<Command[]>(
            `${this.getCommandsRoute()}?team_id=${teamId}&custom_only=true`,
            {method: 'get'},
        );
    };

    executeCommand = (command: string, commandArgs: CommandArgs) => {
        this.trackEvent('api', 'api_integrations_used');

        return this.doFetch<CommandResponse>(
            `${this.getCommandsRoute()}/execute`,
            {method: 'post', body: JSON.stringify({command, ...commandArgs})},
        );
    };

    addCommand = (command: Command) => {
        this.trackEvent('api', 'api_integrations_created');

        return this.doFetch<Command>(
            `${this.getCommandsRoute()}`,
            {method: 'post', body: JSON.stringify(command)},
        );
    };

    editCommand = (command: Command) => {
        this.trackEvent('api', 'api_integrations_created');

        return this.doFetch<Command>(
            `${this.getCommandsRoute()}/${command.id}`,
            {method: 'put', body: JSON.stringify(command)},
        );
    };

    regenCommandToken = (id: string) => {
        return this.doFetch<{
            token: string;
        }>(
            `${this.getCommandsRoute()}/${id}/regen_token`,
            {method: 'put'},
        );
    };

    deleteCommand = (id: string) => {
        this.trackEvent('api', 'api_integrations_deleted');

        return this.doFetch<StatusOK>(
            `${this.getCommandsRoute()}/${id}`,
            {method: 'delete'},
        );
    };

    createOAuthApp = (app: OAuthApp) => {
        this.trackEvent('api', 'api_apps_register');

        return this.doFetch<OAuthApp>(
            `${this.getOAuthAppsRoute()}`,
            {method: 'post', body: JSON.stringify(app)},
        );
    };

    editOAuthApp = (app: OAuthApp) => {
        return this.doFetch<OAuthApp>(
            `${this.getOAuthAppsRoute()}/${app.id}`,
            {method: 'put', body: JSON.stringify(app)},
        );
    };

    getOAuthApps = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<OAuthApp[]>(
            `${this.getOAuthAppsRoute()}${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getAppsOAuthAppIDs = () => {
        return this.doFetch<string[]>(
            `${this.getAppsProxyRoute()}/api/v1/oauth-app-ids`,
            {method: 'get'},
        );
    }

    getAppsBotIDs = () => {
        return this.doFetch<string[]>(
            `${this.getAppsProxyRoute()}/api/v1/bot-ids`,
            {method: 'get'},
        );
    }

    getOAuthApp = (appId: string) => {
        return this.doFetch<OAuthApp>(
            `${this.getOAuthAppRoute(appId)}`,
            {method: 'get'},
        );
    };

    getOAuthAppInfo = (appId: string) => {
        return this.doFetch<OAuthApp>(
            `${this.getOAuthAppRoute(appId)}/info`,
            {method: 'get'},
        );
    };

    deleteOAuthApp = (appId: string) => {
        this.trackEvent('api', 'api_apps_delete');

        return this.doFetch<StatusOK>(
            `${this.getOAuthAppRoute(appId)}`,
            {method: 'delete'},
        );
    };

    regenOAuthAppSecret = (appId: string) => {
        return this.doFetch<OAuthApp>(
            `${this.getOAuthAppRoute(appId)}/regen_secret`,
            {method: 'post'},
        );
    };

    submitInteractiveDialog = (data: DialogSubmission) => {
        this.trackEvent('api', 'api_interactive_messages_dialog_submitted');
        return this.doFetch<SubmitDialogResponse>(
            `${this.getBaseRoute()}/actions/dialogs/submit`,
            {method: 'post', body: JSON.stringify(data)},
        );
    };

    // Emoji Routes

    createCustomEmoji = (emoji: CustomEmoji, imageData: File) => {
        this.trackEvent('api', 'api_emoji_custom_add');

        const formData = new FormData();
        formData.append('image', imageData);
        formData.append('emoji', JSON.stringify(emoji));
        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<CustomEmoji>(
            `${this.getEmojisRoute()}`,
            request,
        );
    };

    getCustomEmoji = (id: string) => {
        return this.doFetch<CustomEmoji>(
            `${this.getEmojisRoute()}/${id}`,
            {method: 'get'},
        );
    };

    getCustomEmojiByName = (name: string) => {
        return this.doFetch<CustomEmoji>(
            `${this.getEmojisRoute()}/name/${name}`,
            {method: 'get'},
        );
    };

    getCustomEmojis = (page = 0, perPage = PER_PAGE_DEFAULT, sort = '') => {
        return this.doFetch<CustomEmoji[]>(
            `${this.getEmojisRoute()}${buildQueryString({page, per_page: perPage, sort})}`,
            {method: 'get'},
        );
    };

    deleteCustomEmoji = (emojiId: string) => {
        this.trackEvent('api', 'api_emoji_custom_delete');

        return this.doFetch<StatusOK>(
            `${this.getEmojiRoute(emojiId)}`,
            {method: 'delete'},
        );
    };

    getSystemEmojiImageUrl = (filename: string) => {
        const extension = filename.endsWith('.png') ? '' : '.png';
        return `${this.url}/static/emoji/${filename}${extension}`;
    };

    getCustomEmojiImageUrl = (id: string) => {
        return `${this.getEmojiRoute(id)}/image`;
    };

    searchCustomEmoji = (term: string, options = {}) => {
        return this.doFetch<CustomEmoji[]>(
            `${this.getEmojisRoute()}/search`,
            {method: 'post', body: JSON.stringify({term, ...options})},
        );
    };

    autocompleteCustomEmoji = (name: string) => {
        return this.doFetch<CustomEmoji[]>(
            `${this.getEmojisRoute()}/autocomplete${buildQueryString({name})}`,
            {method: 'get'},
        );
    };

    // Data Retention

    getDataRetentionPolicy = () => {
        return this.doFetch<DataRetentionPolicy>(
            `${this.getDataRetentionRoute()}/policy`,
            {method: 'get'},
        );
    };

    getDataRetentionCustomPolicies = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<GetDataRetentionCustomPoliciesRequest>(
            `${this.getDataRetentionRoute()}/policies${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getDataRetentionCustomPolicy = (id: string) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}`,
            {method: 'get'},
        );
    };

    deleteDataRetentionCustomPolicy = (id: string) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}`,
            {method: 'delete'},
        );
    };

    searchDataRetentionCustomPolicyChannels = (policyId: string, term: string, opts: ChannelSearchOpts) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${policyId}/channels/search`,
            {method: 'post', body: JSON.stringify({term, ...opts})},
        );
    }

    searchDataRetentionCustomPolicyTeams = (policyId: string, term: string, opts: TeamSearchOpts) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${policyId}/teams/search`,
            {method: 'post', body: JSON.stringify({term, ...opts})},
        );
    }

    getDataRetentionCustomPolicyTeams = (id: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Team[]>(
            `${this.getDataRetentionRoute()}/policies/${id}/teams${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getDataRetentionCustomPolicyChannels = (id: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<{channels: Channel[]; total_count: number}>(
            `${this.getDataRetentionRoute()}/policies/${id}/channels${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    createDataRetentionPolicy = (policy: CreateDataRetentionCustomPolicy) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies`,
            {method: 'post', body: JSON.stringify(policy)},
        );
    };

    updateDataRetentionPolicy = (id: string, policy: PatchDataRetentionCustomPolicy) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}`,
            {method: 'PATCH', body: JSON.stringify(policy)},
        );
    };
    addDataRetentionPolicyTeams = (id: string, teams: string[]) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}/teams`,
            {method: 'post', body: JSON.stringify(teams)},
        );
    };
    removeDataRetentionPolicyTeams = (id: string, teams: string[]) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}/teams`,
            {method: 'delete', body: JSON.stringify(teams)},
        );
    };
    addDataRetentionPolicyChannels = (id: string, channels: string[]) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}/channels`,
            {method: 'post', body: JSON.stringify(channels)},
        );
    };
    removeDataRetentionPolicyChannels = (id: string, channels: string[]) => {
        return this.doFetch<DataRetentionCustomPolicies>(
            `${this.getDataRetentionRoute()}/policies/${id}/channels`,
            {method: 'delete', body: JSON.stringify(channels)},
        );
    };

    // Jobs Routes
    getJob = (id: string) => {
        return this.doFetch<Job>(
            `${this.getJobsRoute()}/${id}`,
            {method: 'get'},
        );
    };

    getJobs = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Job[]>(
            `${this.getJobsRoute()}${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getJobsByType = (type: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Job[]>(
            `${this.getJobsRoute()}/type/${type}${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    createJob = (job: Job) => {
        return this.doFetch<Job>(
            `${this.getJobsRoute()}`,
            {method: 'post', body: JSON.stringify(job)},
        );
    };

    cancelJob = (id: string) => {
        return this.doFetch<StatusOK>(
            `${this.getJobsRoute()}/${id}/cancel`,
            {method: 'post'},
        );
    };

    // Admin Routes

    getLogs = (logFilter: LogFilter) => {
        return this.doFetch<string[]>(
            `${this.getBaseRoute()}/logs/query`,
            {method: 'post', body: JSON.stringify(logFilter)},
        );
    };

    getPlainLogs = (page = 0, perPage = LOGS_PER_PAGE_DEFAULT) => {
        return this.doFetch<string[]>(
            `${this.getBaseRoute()}/logs${buildQueryString({page, logs_per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getAudits = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Audit[]>(
            `${this.getBaseRoute()}/audits${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getConfig = () => {
        return this.doFetch<AdminConfig>(
            `${this.getBaseRoute()}/config`,
            {method: 'get'},
        );
    };

    updateConfig = (config: AdminConfig) => {
        return this.doFetch<AdminConfig>(
            `${this.getBaseRoute()}/config`,
            {method: 'put', body: JSON.stringify(config)},
        );
    };

    patchConfig = (patch: DeepPartial<AdminConfig>) => {
        return this.doFetch<AdminConfig>(
            `${this.getBaseRoute()}/config/patch`,
            {method: 'put', body: JSON.stringify(patch)},
        );
    };

    reloadConfig = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/config/reload`,
            {method: 'post'},
        );
    };

    getEnvironmentConfig = () => {
        return this.doFetch<EnvironmentConfig>(
            `${this.getBaseRoute()}/config/environment`,
            {method: 'get'},
        );
    };

    testEmail = (config: AdminConfig) => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/email/test`,
            {method: 'post', body: JSON.stringify(config)},
        );
    };

    testSiteURL = (siteURL: string) => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/site_url/test`,
            {method: 'post', body: JSON.stringify({site_url: siteURL})},
        );
    };

    testS3Connection = (config: ClientConfig) => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/file/s3_test`,
            {method: 'post', body: JSON.stringify(config)},
        );
    };

    invalidateCaches = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/caches/invalidate`,
            {method: 'post'},
        );
    };

    recycleDatabase = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/database/recycle`,
            {method: 'post'},
        );
    };

    createComplianceReport = (job: Partial<Compliance>) => {
        return this.doFetch<Compliance>(
            `${this.getBaseRoute()}/compliance/reports`,
            {method: 'post', body: JSON.stringify(job)},
        );
    };

    getComplianceReport = (reportId: string) => {
        return this.doFetch<Compliance>(
            `${this.getBaseRoute()}/compliance/reports/${reportId}`,
            {method: 'get'},
        );
    };

    getComplianceReports = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Compliance[]>(
            `${this.getBaseRoute()}/compliance/reports${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    uploadBrandImage = (imageData: File) => {
        const formData = new FormData();
        formData.append('image', imageData);
        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<StatusOK>(
            `${this.getBrandRoute()}/image`,
            request,
        );
    };

    deleteBrandImage = () => {
        return this.doFetch<StatusOK>(
            `${this.getBrandRoute()}/image`,
            {method: 'delete'},
        );
    };

    getClusterStatus = () => {
        return this.doFetch<ClusterInfo[]>(
            `${this.getBaseRoute()}/cluster/status`,
            {method: 'get'},
        );
    };

    testLdap = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/test`,
            {method: 'post'},
        );
    };

    syncLdap = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/sync`,
            {method: 'post'},
        );
    };

    getLdapGroups = (page = 0, perPage = PER_PAGE_DEFAULT, opts = {}) => {
        const query = {page, per_page: perPage, ...opts};
        return this.doFetch<{
            count: number;
            groups: MixedUnlinkedGroup[];
        }>(
            `${this.getBaseRoute()}/ldap/groups${buildQueryString(query)}`,
            {method: 'get'},
        );
    };

    linkLdapGroup = (key: string) => {
        return this.doFetch<Group>(
            `${this.getBaseRoute()}/ldap/groups/${encodeURI(key)}/link`,
            {method: 'post'},
        );
    };

    unlinkLdapGroup = (key: string) => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/groups/${encodeURI(key)}/link`,
            {method: 'delete'},
        );
    };

    getSamlCertificateStatus = () => {
        return this.doFetch<SamlCertificateStatus>(
            `${this.getBaseRoute()}/saml/certificate/status`,
            {method: 'get'},
        );
    };

    uploadPublicSamlCertificate = (fileData: File) => {
        const formData = new FormData();
        formData.append('certificate', fileData);

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/public`,
            {
                method: 'post',
                body: formData,
            },
        );
    };

    uploadPrivateSamlCertificate = (fileData: File) => {
        const formData = new FormData();
        formData.append('certificate', fileData);

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/private`,
            {
                method: 'post',
                body: formData,
            },
        );
    };

    uploadPublicLdapCertificate = (fileData: File) => {
        const formData = new FormData();
        formData.append('certificate', fileData);

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/certificate/public`,
            {
                method: 'post',
                body: formData,
            },
        );
    };

    uploadPrivateLdapCertificate = (fileData: File) => {
        const formData = new FormData();
        formData.append('certificate', fileData);

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/certificate/private`,
            {
                method: 'post',
                body: formData,
            },
        );
    };

    uploadIdpSamlCertificate = (fileData: File) => {
        const formData = new FormData();
        formData.append('certificate', fileData);

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/idp`,
            {
                method: 'post',
                body: formData,
            },
        );
    };

    deletePublicSamlCertificate = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/public`,
            {method: 'delete'},
        );
    };

    deletePrivateSamlCertificate = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/private`,
            {method: 'delete'},
        );
    };

    deletePublicLdapCertificate = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/certificate/public`,
            {method: 'delete'},
        );
    };

    deletePrivateLdapCertificate = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/ldap/certificate/private`,
            {method: 'delete'},
        );
    };

    deleteIdpSamlCertificate = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/idp`,
            {method: 'delete'},
        );
    };

    testElasticsearch = (config: ClientConfig) => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/elasticsearch/test`,
            {method: 'post', body: JSON.stringify(config)},
        );
    };

    purgeElasticsearchIndexes = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/elasticsearch/purge_indexes`,
            {method: 'post'},
        );
    };

    purgeBleveIndexes = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/bleve/purge_indexes`,
            {method: 'post'},
        );
    };

    uploadLicense = (fileData: File) => {
        this.trackEvent('api', 'api_license_upload');

        const formData = new FormData();
        formData.append('license', fileData);

        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<License>(
            `${this.getBaseRoute()}/license`,
            request,
        );
    };

    requestTrialLicense = (body: RequestLicenseBody) => {
        return this.doFetchWithResponse<ClientLicense>(
            `${this.getBaseRoute()}/trial-license`,
            {method: 'POST', body: JSON.stringify(body)},
        );
    }

    removeLicense = () => {
        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/license`,
            {method: 'delete'},
        );
    };

    getPrevTrialLicense = () => {
        return this.doFetch<ClientLicense>(
            `${this.getBaseRoute()}/trial-license/prev`,
            {method: 'get'},
        );
    }

    getAnalytics = (name = 'standard', teamId = '') => {
        return this.doFetch<AnalyticsRow[]>(
            `${this.getBaseRoute()}/analytics/old${buildQueryString({name, team_id: teamId})}`,
            {method: 'get'},
        );
    };

    // Role Routes

    getRole = (roleId: string) => {
        return this.doFetch<Role>(
            `${this.getRolesRoute()}/${roleId}`,
            {method: 'get'},
        );
    };

    getRoleByName = (roleName: string) => {
        return this.doFetch<Role>(
            `${this.getRolesRoute()}/name/${roleName}`,
            {method: 'get'},
        );
    };

    getRolesByNames = (rolesNames: string[]) => {
        return this.doFetch<Role[]>(
            `${this.getRolesRoute()}/names`,
            {method: 'post', body: JSON.stringify(rolesNames)},
        );
    };

    patchRole = (roleId: string, rolePatch: Partial<Role>) => {
        return this.doFetch<Role>(
            `${this.getRolesRoute()}/${roleId}/patch`,
            {method: 'put', body: JSON.stringify(rolePatch)},
        );
    };

    // Scheme Routes

    getSchemes = (scope = '', page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Scheme[]>(
            `${this.getSchemesRoute()}${buildQueryString({scope, page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    createScheme = (scheme: Scheme) => {
        this.trackEvent('api', 'api_schemes_create');

        return this.doFetch<Scheme>(
            `${this.getSchemesRoute()}`,
            {method: 'post', body: JSON.stringify(scheme)},
        );
    };

    getScheme = (schemeId: string) => {
        return this.doFetch<Scheme>(
            `${this.getSchemesRoute()}/${schemeId}`,
            {method: 'get'},
        );
    };

    deleteScheme = (schemeId: string) => {
        this.trackEvent('api', 'api_schemes_delete');

        return this.doFetch<StatusOK>(
            `${this.getSchemesRoute()}/${schemeId}`,
            {method: 'delete'},
        );
    };

    patchScheme = (schemeId: string, schemePatch: Partial<Scheme>) => {
        this.trackEvent('api', 'api_schemes_patch', {scheme_id: schemeId});

        return this.doFetch<Scheme>(
            `${this.getSchemesRoute()}/${schemeId}/patch`,
            {method: 'put', body: JSON.stringify(schemePatch)},
        );
    };

    getSchemeTeams = (schemeId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Team[]>(
            `${this.getSchemesRoute()}/${schemeId}/teams${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    getSchemeChannels = (schemeId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Channel[]>(
            `${this.getSchemesRoute()}/${schemeId}/channels${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    };

    // Plugin Routes

    uploadPlugin = async (fileData: File, force = false) => {
        this.trackEvent('api', 'api_plugin_upload');

        const formData = new FormData();
        if (force) {
            formData.append('force', 'true');
        }
        formData.append('plugin', fileData);

        const request: any = {
            method: 'post',
            body: formData,
        };

        return this.doFetch<PluginManifest>(
            this.getPluginsRoute(),
            request,
        );
    };

    installPluginFromUrl = (pluginDownloadUrl: string, force = false) => {
        this.trackEvent('api', 'api_install_plugin');

        const queryParams = {plugin_download_url: pluginDownloadUrl, force};

        return this.doFetch<PluginManifest>(
            `${this.getPluginsRoute()}/install_from_url${buildQueryString(queryParams)}`,
            {method: 'post'},
        );
    };

    getPlugins = () => {
        return this.doFetch<PluginsResponse>(
            this.getPluginsRoute(),
            {method: 'get'},
        );
    };

    getRemoteMarketplacePlugins = (filter: string) => {
        return this.doFetch<MarketplacePlugin[]>(
            `${this.getPluginsMarketplaceRoute()}${buildQueryString({filter: filter || '', remote_only: true})}`,
            {method: 'get'},
        );
    }

    getMarketplacePlugins = (filter: string, localOnly = false) => {
        return this.doFetch<MarketplacePlugin[]>(
            `${this.getPluginsMarketplaceRoute()}${buildQueryString({filter: filter || '', local_only: localOnly})}`,
            {method: 'get'},
        );
    }

    installMarketplacePlugin = (id: string) => {
        this.trackEvent('api', 'api_install_marketplace_plugin');

        return this.doFetch<MarketplacePlugin>(
            `${this.getPluginsMarketplaceRoute()}`,
            {method: 'post', body: JSON.stringify({id})},
        );
    }

    getMarketplaceApps = (filter: string) => {
        return this.doFetch<MarketplaceApp[]>(
            `${this.getAppsProxyRoute()}/api/v1/marketplace${buildQueryString({filter: filter || ''})}`,
            {method: 'get'},
        );
    }

    getPluginStatuses = () => {
        return this.doFetch<PluginStatus[]>(
            `${this.getPluginsRoute()}/statuses`,
            {method: 'get'},
        );
    };

    removePlugin = (pluginId: string) => {
        return this.doFetch<StatusOK>(
            this.getPluginRoute(pluginId),
            {method: 'delete'},
        );
    };

    getWebappPlugins = () => {
        return this.doFetch<ClientPluginManifest[]>(
            `${this.getPluginsRoute()}/webapp`,
            {method: 'get'},
        );
    };

    enablePlugin = (pluginId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getPluginRoute(pluginId)}/enable`,
            {method: 'post'},
        );
    };

    disablePlugin = (pluginId: string) => {
        return this.doFetch<StatusOK>(
            `${this.getPluginRoute(pluginId)}/disable`,
            {method: 'post'},
        );
    };

    // Groups
    linkGroupSyncable = (groupID: string, syncableID: string, syncableType: string, patch: SyncablePatch) => {
        return this.doFetch<GroupSyncable>(
            `${this.getGroupRoute(groupID)}/${syncableType}s/${syncableID}/link`,
            {method: 'post', body: JSON.stringify(patch)},
        );
    };

    unlinkGroupSyncable = (groupID: string, syncableID: string, syncableType: string) => {
        return this.doFetch<StatusOK>(
            `${this.getGroupRoute(groupID)}/${syncableType}s/${syncableID}/link`,
            {method: 'delete'},
        );
    };

    getGroupSyncables = (groupID: string, syncableType: string) => {
        return this.doFetch<GroupSyncable[]>(
            `${this.getGroupRoute(groupID)}/${syncableType}s`,
            {method: 'get'},
        );
    };

    getGroup = (groupID: string, includeMemberCount = false) => {
        return this.doFetch<Group>(
            `${this.getGroupRoute(groupID)}${buildQueryString({include_member_count: includeMemberCount})}`,
            {method: 'get'},
        );
    };

    getGroupStats = (groupID: string) => {
        return this.doFetch<Group>(
            `${this.getGroupRoute(groupID)}/stats`,
            {method: 'get'},
        );
    };

    getGroups = (filterAllowReference = false, page = 0, perPage = 10, includeMemberCount = false, hasFilterMember = false) => {
        const qs: any = {
            filter_allow_reference: filterAllowReference,
            page,
            per_page: perPage,
            include_member_count: includeMemberCount,
        };

        if (hasFilterMember) {
            qs.filter_has_member = hasFilterMember;
        }
        return this.doFetch<Group[]>(
            `${this.getGroupsRoute()}${buildQueryString(qs)}`,
            {method: 'get'},
        );
    };

    getGroupsByUserId = (userID: string) => {
        return this.doFetch<Group[]>(
            `${this.getUsersRoute()}/${userID}/groups`,
            {method: 'get'},
        );
    };

    getGroupsNotAssociatedToTeam = (teamID: string, q = '', page = 0, perPage = PER_PAGE_DEFAULT, source = 'ldap') => {
        this.trackEvent('api', 'api_groups_get_not_associated_to_team', {team_id: teamID});
        return this.doFetch<Group[]>(
            `${this.getGroupsRoute()}${buildQueryString({not_associated_to_team: teamID, page, per_page: perPage, q, include_member_count: true, group_source: source})}`,
            {method: 'get'},
        );
    };

    getGroupsNotAssociatedToChannel = (channelID: string, q = '', page = 0, perPage = PER_PAGE_DEFAULT, filterParentTeamPermitted = false, source = 'ldap') => {
        this.trackEvent('api', 'api_groups_get_not_associated_to_channel', {channel_id: channelID});
        const query = {
            not_associated_to_channel: channelID,
            page,
            per_page: perPage,
            q,
            include_member_count: true,
            filter_parent_team_permitted: filterParentTeamPermitted,
            group_source: source,
        };
        return this.doFetch<Group[]>(
            `${this.getGroupsRoute()}${buildQueryString(query)}`,
            {method: 'get'},
        );
    };

    createGroupWithUserIds = (group: GroupCreateWithUserIds) => {
        return this.doFetch<Group>(
            this.getGroupsRoute(),
            {method: 'post', body: JSON.stringify(group)},
        );
    }

    addUsersToGroup = (groupId: string, userIds: string[]) => {
        return this.doFetch<UserProfile[]>(
            `${this.getGroupRoute(groupId)}/members`,
            {method: 'post', body: JSON.stringify({user_ids: userIds})},
        );
    }

    removeUsersFromGroup = (groupId: string, userIds: string[]) => {
        return this.doFetch<UserProfile[]>(
            `${this.getGroupRoute(groupId)}/members`,
            {method: 'delete', body: JSON.stringify({user_ids: userIds})},
        );
    }

    searchGroups = (params: GroupSearachParams) => {
        return this.doFetch<Group[]>(
            `${this.getGroupsRoute()}${buildQueryString(params)}`,
            {method: 'get'},
        );
    }

    executeAppCall = async (call: AppCallRequest, trackAsSubmit: boolean) => {
        const callCopy: AppCallRequest = {
            ...call,
            context: {
                ...call.context,
                track_as_submit: trackAsSubmit,
                user_agent: 'webapp',
            },
        };
        return this.doFetch<AppCallResponse>(
            `${this.getAppsProxyRoute()}/api/v1/call`,
            {method: 'post', body: JSON.stringify(callCopy)},
        );
    }

    getAppsBindings = async (channelID: string, teamID: string) => {
        const params = {
            channel_id: channelID,
            team_id: teamID,
            user_agent: 'webapp',
        };

        return this.doFetch<AppBinding[]>(
            `${this.getAppsProxyRoute()}/api/v1/bindings${buildQueryString(params)}`,
            {method: 'get'},
        );
    }

    getGroupsAssociatedToTeam = (teamID: string, q = '', page = 0, perPage = PER_PAGE_DEFAULT, filterAllowReference = false) => {
        this.trackEvent('api', 'api_groups_get_associated_to_team', {team_id: teamID});

        return this.doFetch<{
            groups: Group[];
            total_group_count: number;
        }>(
            `${this.getBaseRoute()}/teams/${teamID}/groups${buildQueryString({page, per_page: perPage, q, include_member_count: true, filter_allow_reference: filterAllowReference})}`,
            {method: 'get'},
        );
    };

    getGroupsAssociatedToChannel = (channelID: string, q = '', page = 0, perPage = PER_PAGE_DEFAULT, filterAllowReference = false) => {
        this.trackEvent('api', 'api_groups_get_associated_to_channel', {channel_id: channelID});

        return this.doFetch<{
            groups: Group[];
            total_group_count: number;
        }>(
            `${this.getBaseRoute()}/channels/${channelID}/groups${buildQueryString({page, per_page: perPage, q, include_member_count: true, filter_allow_reference: filterAllowReference})}`,
            {method: 'get'},
        );
    };

    getAllGroupsAssociatedToTeam = (teamID: string, filterAllowReference = false, includeMemberCount = false) => {
        return this.doFetch<GroupsWithCount>(
            `${this.getBaseRoute()}/teams/${teamID}/groups${buildQueryString({paginate: false, filter_allow_reference: filterAllowReference, include_member_count: includeMemberCount})}`,
            {method: 'get'},
        );
    };

    getAllGroupsAssociatedToChannelsInTeam = (teamID: string, filterAllowReference = false) => {
        return this.doFetch<{
            groups: RelationOneToOne<Channel, Group>;
        }>(
            `${this.getBaseRoute()}/teams/${teamID}/groups_by_channels${buildQueryString({paginate: false, filter_allow_reference: filterAllowReference})}`,
            {method: 'get'},
        );
    };

    getAllGroupsAssociatedToChannel = (channelID: string, filterAllowReference = false, includeMemberCount = false) => {
        return this.doFetch<GroupsWithCount>(
            `${this.getBaseRoute()}/channels/${channelID}/groups${buildQueryString({paginate: false, filter_allow_reference: filterAllowReference, include_member_count: includeMemberCount})}`,
            {method: 'get'},
        );
    };

    patchGroupSyncable = (groupID: string, syncableID: string, syncableType: string, patch: SyncablePatch) => {
        return this.doFetch<GroupSyncable>(
            `${this.getGroupRoute(groupID)}/${syncableType}s/${syncableID}/patch`,
            {method: 'put', body: JSON.stringify(patch)},
        );
    };

    patchGroup = (groupID: string, patch: GroupPatch | CustomGroupPatch) => {
        return this.doFetch<Group>(
            `${this.getGroupRoute(groupID)}/patch`,
            {method: 'put', body: JSON.stringify(patch)},
        );
    };

    archiveGroup = (groupId: string) => {
        return this.doFetch<Group>(
            `${this.getGroupRoute(groupId)}`,
            {method: 'delete'},
        );
    }

    createGroupTeamsAndChannels = (userID: string) => {
        return this.doFetch<Group>(
            `${this.getBaseRoute()}/ldap/users/${userID}/group_sync_memberships`,
            {method: 'post'},
        );
    }

    // Redirect Location
    getRedirectLocation = (urlParam: string) => {
        if (!urlParam.length) {
            return Promise.resolve();
        }
        const url = `${this.getRedirectLocationRoute()}${buildQueryString({url: urlParam})}`;
        return this.doFetch<{
            location: string;
        }>(url, {method: 'get'});
    };

    // Bot Routes

    createBot = (bot: Bot) => {
        return this.doFetch<Bot>(
            `${this.getBotsRoute()}`,
            {method: 'post', body: JSON.stringify(bot)},
        );
    }

    patchBot = (botUserId: string, botPatch: BotPatch) => {
        return this.doFetch<Bot>(
            `${this.getBotRoute(botUserId)}`,
            {method: 'put', body: JSON.stringify(botPatch)},
        );
    }

    getBot = (botUserId: string) => {
        return this.doFetch<Bot>(
            `${this.getBotRoute(botUserId)}`,
            {method: 'get'},
        );
    }

    getBots = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Bot[]>(
            `${this.getBotsRoute()}${buildQueryString({page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    getBotsIncludeDeleted = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Bot[]>(
            `${this.getBotsRoute()}${buildQueryString({include_deleted: true, page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    getBotsOrphaned = (page = 0, perPage = PER_PAGE_DEFAULT) => {
        return this.doFetch<Bot[]>(
            `${this.getBotsRoute()}${buildQueryString({only_orphaned: true, page, per_page: perPage})}`,
            {method: 'get'},
        );
    }

    disableBot = (botUserId: string) => {
        return this.doFetch<Bot>(
            `${this.getBotRoute(botUserId)}/disable`,
            {method: 'post'},
        );
    }

    enableBot = (botUserId: string) => {
        return this.doFetch<Bot>(
            `${this.getBotRoute(botUserId)}/enable`,
            {method: 'post'},
        );
    }

    assignBot = (botUserId: string, newOwnerId: string) => {
        return this.doFetch<Bot>(
            `${this.getBotRoute(botUserId)}/assign/${newOwnerId}`,
            {method: 'post'},
        );
    }

    // Cloud routes
    getCloudProducts = (includeLegacyProducts?: boolean) => {
        let query = '';
        if (includeLegacyProducts) {
            query = '?include_legacy=true';
        }
        return this.doFetch<Product[]>(
            `${this.getCloudRoute()}/products${query}`, {method: 'get'},
        );
    };

    bootstrapSelfHostedSignup = (reset?: boolean) => {
        let query = '';

        // reset will drop the old token
        if (reset) {
            query = '?reset=true';
        }
        return this.doFetch<SelfHostedSignupBootstrapResponse>(
            `${this.getHostedCustomerRoute()}/bootstrap${query}`,
            {method: 'post'},
        );
    };

    getAvailabilitySelfHostedSignup = () => {
        return this.doFetch<void>(
            `${this.getHostedCustomerRoute()}/signup_available`,
            {method: 'get'},
        );
    }

    getSelfHostedProducts = () => {
        return this.doFetch<Product[]>(
            `${this.getCloudRoute()}/products/selfhosted`, {method: 'get'},
        );
    }

    createCustomerSelfHostedSignup = (form: SelfHostedSignupForm) => {
        return this.doFetch<SelfHostedSignupCustomerResponse>(
            `${this.getHostedCustomerRoute()}/customer`,
            {method: 'post', body: JSON.stringify(form)},
        );
    };

    confirmSelfHostedSignup = (setupIntentId: string, createSubscriptionRequest: CreateSubscriptionRequest) => {
        return this.doFetch<SelfHostedSignupSuccessResponse>(
            `${this.getHostedCustomerRoute()}/confirm`,
            {method: 'post', body: JSON.stringify({stripe_setup_intent_id: setupIntentId, subscription: createSubscriptionRequest})},
        );
    };


    confirmSelfHostedExpansion = (setupIntentId: string, expandRequest: SelfHostedExpansionRequest) => {
        return this.doFetch<SelfHostedSignupSuccessResponse>(
            `${this.getHostedCustomerRoute()}/confirm-expand`,
            {method: 'post', body: JSON.stringify({stripe_setup_intent_id: setupIntentId, expand_request: expandRequest})},
        );
    }

    subscribeToNewsletter = (newletterRequestBody: NewsletterRequestBody) => {
        return this.doFetch<StatusOK>(
            `${this.getHostedCustomerRoute()}/subscribe-newsletter`,
            {method: 'post', body: JSON.stringify(newletterRequestBody)},
        );
    };

    createPaymentMethod = async () => {
        return this.doFetch(
            `${this.getCloudRoute()}/payment`,
            {method: 'post'},
        );
    }

    getCloudCustomer = () => {
        return this.doFetch<CloudCustomer>(
            `${this.getCloudRoute()}/customer`, {method: 'get'},
        );
    }

    getLicenseSelfServeStatus = () => {
        return this.doFetch<LicenseSelfServeStatus>(
            `${this.getCloudRoute()}/subscription/self-serve-status`, {method: 'get'},
        );
    }

    updateCloudCustomer = (customerPatch: CloudCustomerPatch) => {
        return this.doFetch<CloudCustomer>(
            `${this.getCloudRoute()}/customer`,
            {method: 'put', body: JSON.stringify(customerPatch)},
        );
    }

    updateCloudCustomerAddress = (address: Address) => {
        return this.doFetch<CloudCustomer>(
            `${this.getCloudRoute()}/customer/address`,
            {method: 'put', body: JSON.stringify(address)},
        );
    }

    notifyAdmin = (req: NotifyAdminRequest) => {
        return this.doFetchWithResponse<StatusOK>(
            `${this.getUsersRoute()}/notify-admin`,
            {method: 'post', body: JSON.stringify(req)},
        );
    }

    confirmPaymentMethod = async (stripeSetupIntentID: string) => {
        return this.doFetch(
            `${this.getCloudRoute()}/payment/confirm`,
            {method: 'post', body: JSON.stringify({stripe_setup_intent_id: stripeSetupIntentID})},
        );
    }

    subscribeCloudProduct = (productId: string, shippingAddress?: Address, seats = 0, downgradeFeedback?: Feedback) => {
        const body = {
            product_id: productId,
            seats,
            downgrade_feedback: downgradeFeedback,
        } as any;
        if (shippingAddress) {
            body.shipping_address = shippingAddress;
        }
        return this.doFetch<Subscription>(
            `${this.getCloudRoute()}/subscription`,
            {method: 'put', body: JSON.stringify(body)},
        );
    }

    requestCloudTrial = (subscriptionId: string, email = '') => {
        return this.doFetchWithResponse<Subscription>(
            `${this.getCloudRoute()}/request-trial`,
            {method: 'put', body: JSON.stringify({email, subscription_id: subscriptionId})},
        );
    }

    validateBusinessEmail = (email = '') => {
        return this.doFetchWithResponse<ValidBusinessEmail>(
            `${this.getCloudRoute()}/validate-business-email`,
            {method: 'post', body: JSON.stringify({email})},
        );
    }

    validateWorkspaceBusinessEmail = () => {
        return this.doFetchWithResponse<ValidBusinessEmail>(
            `${this.getCloudRoute()}/validate-workspace-business-email`,
            {method: 'post'},
        );
    }

    getSubscription = () => {
        return this.doFetch<Subscription>(
            `${this.getCloudRoute()}/subscription`,
            {method: 'get'},
        );
    }

    getRenewalLink = () => {
        return this.doFetch<{renewal_link: string}>(
            `${this.getBaseRoute()}/license/renewal`,
            {method: 'get'},
        );
    }

    getInvoices = () => {
        return this.doFetch<Invoice[]>(
            `${this.getCloudRoute()}/subscription/invoices`,
            {method: 'get'},
        );
    }

    getInvoicePdfUrl = (invoiceId: string) => {
        return `${this.getCloudRoute()}/subscription/invoices/${invoiceId}/pdf`;
    }

    getSelfHostedInvoices = () => {
        return this.doFetch<Invoice[]>(
            `${this.getHostedCustomerRoute()}/invoices`,
            {method: 'get'},
        );
    }

    getSelfHostedInvoicePdfUrl = (invoiceId: string) => {
        return `${this.getHostedCustomerRoute()}/invoices/${invoiceId}/pdf`;
    }

    getCloudLimits = () => {
        return this.doFetch<Limits>(
            `${this.getCloudRoute()}/limits`,
            {method: 'get'},
        );
    }

    getPostsUsage = () => {
        return this.doFetch<PostsUsageResponse>(
            `${this.getUsageRoute()}/posts`,
            {method: 'get'},
        );
    }

    getFilesUsage = () => {
        return this.doFetch<FilesUsageResponse>(
            `${this.getUsageRoute()}/storage`,
            {method: 'get'},
        );
    }

    getTeamsUsage = () => {
        return this.doFetch<TeamsUsageResponse>(
            `${this.getUsageRoute()}/teams`,
            {method: 'get'},
        );
    }

    teamMembersMinusGroupMembers = (teamID: string, groupIDs: string[], page: number, perPage: number) => {
        const query = `group_ids=${groupIDs.join(',')}&page=${page}&per_page=${perPage}`;
        return this.doFetch<UsersWithGroupsAndCount>(
            `${this.getTeamRoute(teamID)}/members_minus_group_members?${query}`,
            {method: 'get'},
        );
    }

    channelMembersMinusGroupMembers = (channelID: string, groupIDs: string[], page: number, perPage: number) => {
        const query = `group_ids=${groupIDs.join(',')}&page=${page}&per_page=${perPage}`;
        return this.doFetch<UsersWithGroupsAndCount>(
            `${this.getChannelRoute(channelID)}/members_minus_group_members?${query}`,
            {method: 'get'},
        );
    }

    getSamlMetadataFromIdp = (samlMetadataURL: string) => {
        return this.doFetch<SamlMetadataResponse>(
            `${this.getBaseRoute()}/saml/metadatafromidp`, {method: 'post', body: JSON.stringify({saml_metadata_url: samlMetadataURL})},
        );
    };

    setSamlIdpCertificateFromMetadata = (certData: string) => {
        const request: any = {
            method: 'post',
            body: certData,
        };

        request.headers = {
            'Content-Type': 'application/x-pem-file',
        };

        return this.doFetch<StatusOK>(
            `${this.getBaseRoute()}/saml/certificate/idp`,
            request,
        );
    };

    getInProductNotices = (teamId: string, client: string, clientVersion: string) => {
        return this.doFetch<ProductNotices>(
            `${this.getNoticesRoute()}/${teamId}?client=${client}&clientVersion=${clientVersion}`,
            {method: 'get'},
        );
    };

    updateNoticesAsViewed = (noticeIds: string[]) => {
        // Only one notice is marked as viewed at a time so using 0 index
        this.trackEvent('ui', `notice_seen_${noticeIds[0]}`);
        return this.doFetch<StatusOK>(
            `${this.getNoticesRoute()}/view`,
            {method: 'put', body: JSON.stringify(noticeIds)},
        );
    }

    getAncillaryPermissions = (subsectionPermissions: string[]) => {
        return this.doFetch<string[]>(
            `${this.getPermissionsRoute()}/ancillary?subsection_permissions=${subsectionPermissions.join(',')}`,
            {method: 'get'},
        );
    }

    completeSetup = (completeOnboardingRequest: CompleteOnboardingRequest) => {
        return this.doFetch<StatusOK>(
            `${this.getSystemRoute()}/onboarding/complete`,
            {method: 'post', body: JSON.stringify(completeOnboardingRequest)},
        );
    }

    getAppliedSchemaMigrations = () => {
        return this.doFetch<SchemaMigration[]>(
            `${this.getSystemRoute()}/schema/version`,
            {method: 'get'},
        );
    }

    /**
     * @param query string query of graphQL, pass the json stringified version of the query
     * eg.  const query = JSON.stringify({query: `{license, config}`, operationName: 'queryForLicenseAndConfig'});
     *      client4.fetchWithGraphQL(query);
     */
    fetchWithGraphQL = async <DataResponse>(query: string) => {
        return this.doFetch<DataResponse>(this.getGraphQLUrl(), {method: 'post', body: query});
    }

    getCallsChannelState = (channelId: string) => {
        return this.doFetch<{enabled: boolean; id: string}>(
            `${this.url}/plugins/${'com.mattermost.calls'}/${channelId}`,
            {method: 'get'},
        );
    }

    // Client Helpers

    protected doFetch = async <ClientDataResponse>(url: string, options: Options): Promise<ClientDataResponse> => {
        const {data} = await this.doFetchWithResponse<ClientDataResponse>(url, options);

        return data;
    };

    private doFetchWithResponse = async <ClientDataResponse>(url: string, options: Options): Promise<ClientResponse<ClientDataResponse>> => {
        const response = await fetch(url, this.getOptions(options));
        const headers = parseAndMergeNestedHeaders(response.headers);

        let data;
        try {
            data = await response.json();
        } catch (err) {
            throw new ClientError(this.getUrl(), {
                message: 'Received invalid response from the server.',
                url,
            }, err);
        }

        if (headers.has(HEADER_X_VERSION_ID) && !headers.get('Cache-Control')) {
            const serverVersion = headers.get(HEADER_X_VERSION_ID);
            if (serverVersion && this.serverVersion !== serverVersion) {
                this.serverVersion = serverVersion;
            }
        }

        if (headers.has(HEADER_X_CLUSTER_ID)) {
            const clusterId = headers.get(HEADER_X_CLUSTER_ID);
            if (clusterId && this.clusterId !== clusterId) {
                this.clusterId = clusterId;
            }
        }

        if (response.ok) {
            return {
                response,
                headers,
                data,
            };
        }

        const msg = data.message || '';

        if (this.logToConsole) {
            console.error(msg); // eslint-disable-line no-console
        }

        throw new ClientError(this.getUrl(), {
            message: msg,
            server_error_id: data.id,
            status_code: data.status_code,
            url,
        });
    };

    trackEvent(category: string, event: string, props?: any) {
        if (this.telemetryHandler) {
            this.telemetryHandler.trackEvent(this.userId, this.userRoles, category, event, props);
        }
    }

    pageVisited(category: string, name: string) {
        if (this.telemetryHandler) {
            this.telemetryHandler.pageVisited(this.userId, this.userRoles, category, name);
        }
    }

    upsertDraft = async (draft: Draft, connectionId: string) => {
        const result = await this.doFetch<Draft>(
            `${this.getDraftsRoute()}`,
            {
                method: 'post',
                body: JSON.stringify(draft),
                headers: {
                    'Connection-Id': `${connectionId}`,
                },
            },
        );

        return result;
    };

    getUserDrafts = (teamId: Team['id']) => {
        return this.doFetch<Draft[]>(
            `${this.getUserRoute('me')}/teams/${teamId}/drafts`,
            {method: 'get'},
        );
    };

    deleteDraft = (channelId: Channel['id'], rootId = '', connectionId: string) => {
        let endpoint = `${this.getUserRoute('me')}/channels/${channelId}/drafts`;
        if (rootId !== '') {
            endpoint += `/${rootId}`;
        }

        return this.doFetch<null>(
            endpoint,
            {
                method: 'delete',
                headers: {
                    'Connection-Id': `${connectionId}`,
                },
            },
        );
    };

    submitTrueUpReview = () => {
        return this.doFetch(
            `${this.getBaseRoute()}/license/review`,
            {method: 'post'},
        );
    }

    getTrueUpReviewStatus = () => {
        return this.doFetch(
            `${this.getBaseRoute()}/license/review/status`,
            {method: 'get'},
        );
    }

    cwsAvailabilityCheck = () => {
        return this.doFetchWithResponse(
            `${this.getCloudRoute()}/check-cws-connection`,
            {method: 'get'},
        );
    }

    deleteWorkspace = (deletionRequest: WorkspaceDeletionRequest) => {
        return this.doFetch<StatusOK>(
            `${this.getCloudRoute()}/delete-workspace`,
            {method: 'delete', body: JSON.stringify(deletionRequest)},
        );
    }

    getGroupMessageMembersCommonTeams = (channelId: string) => {
        return this.doFetchWithResponse<Team[]>(
            `${this.getChannelRoute(channelId)}/common_teams`,
            {method: 'get'},
        )
    }

    convertGroupMessageToPrivateChannel = (channelId: string, teamId: string) => {
        return this.doFetch<Channel>(
            `${this.getChannelRoute(channelId)}/convert_to_channel?team_id=${teamId}`,
            {method: 'post'},
        )
    }
}

export function parseAndMergeNestedHeaders(originalHeaders: any) {
    const headers = new Map();
    let nestedHeaders = new Map();
    originalHeaders.forEach((val: string, key: string) => {
        const capitalizedKey = key.replace(/\b[a-z]/g, (l) => l.toUpperCase());
        let realVal = val;
        if (val && val.match(/\n\S+:\s\S+/)) {
            const nestedHeaderStrings = val.split('\n');
            realVal = nestedHeaderStrings.shift() as string;
            const moreNestedHeaders = new Map(
                nestedHeaderStrings.map((h: any) => h.split(/:\s/)),
            );
            nestedHeaders = new Map([...nestedHeaders, ...moreNestedHeaders]);
        }
        headers.set(capitalizedKey, realVal);
    });
    return new Map([...headers, ...nestedHeaders]);
}

export class ClientError extends Error implements ServerError {
    url?: string;
    server_error_id?: string;
    status_code?: number;

    constructor(baseUrl: string, data: ServerError, cause?: any) {
        super(data.message + ': ' + cleanUrlForLogging(baseUrl, data.url || ''), {cause});

        this.message = data.message;
        this.url = data.url;
        this.server_error_id = data.server_error_id;
        this.status_code = data.status_code;

        // Ensure message is treated as a property of this class when object spreading. Without this,
        // copying the object by using `{...error}` would not include the message.
        Object.defineProperty(this, 'message', {enumerable: true});
    }
}
