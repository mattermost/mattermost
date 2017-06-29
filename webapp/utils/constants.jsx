// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import keyMirror from 'key-mirror';

import audioIcon from 'images/icons/audio.png';
import videoIcon from 'images/icons/video.png';
import excelIcon from 'images/icons/excel.png';
import pptIcon from 'images/icons/ppt.png';
import pdfIcon from 'images/icons/pdf.png';
import codeIcon from 'images/icons/code.png';
import wordIcon from 'images/icons/word.png';
import patchIcon from 'images/icons/patch.png';
import genericIcon from 'images/icons/generic.png';

import logoImage from 'images/logo_compact.png';
import logoWebhook from 'images/webhook_icon.jpg';

import solarizedDarkCSS from '!!file-loader?name=files/code_themes/[hash].[ext]!highlight.js/styles/solarized-dark.css';
import solarizedDarkIcon from 'images/themes/code_themes/solarized-dark.png';

import solarizedLightCSS from '!!file-loader?name=files/code_themes/[hash].[ext]!highlight.js/styles/solarized-light.css';
import solarizedLightIcon from 'images/themes/code_themes/solarized-light.png';

import githubCSS from '!!file-loader?name=files/code_themes/[hash].[ext]!highlight.js/styles/github.css';
import githubIcon from 'images/themes/code_themes/github.png';

import monokaiCSS from '!!file-loader?name=files/code_themes/[hash].[ext]!highlight.js/styles/monokai.css';
import monokaiIcon from 'images/themes/code_themes/monokai.png';

import defaultThemeImage from 'images/themes/organization.png';
import mattermostDarkThemeImage from 'images/themes/mattermost_dark.png';
import mattermostThemeImage from 'images/themes/mattermost.png';
import windows10ThemeImage from 'images/themes/windows_dark.png';

export const Preferences = {
    CATEGORY_DIRECT_CHANNEL_SHOW: 'direct_channel_show',
    CATEGORY_GROUP_CHANNEL_SHOW: 'group_channel_show',
    CATEGORY_DISPLAY_SETTINGS: 'display_settings',
    CATEGORY_ADVANCED_SETTINGS: 'advanced_settings',
    TUTORIAL_STEP: 'tutorial_step',
    CHANNEL_DISPLAY_MODE: 'channel_display_mode',
    CHANNEL_DISPLAY_MODE_CENTERED: 'centered',
    CHANNEL_DISPLAY_MODE_FULL_SCREEN: 'full',
    CHANNEL_DISPLAY_MODE_DEFAULT: 'full',
    MESSAGE_DISPLAY: 'message_display',
    MESSAGE_DISPLAY_CLEAN: 'clean',
    MESSAGE_DISPLAY_COMPACT: 'compact',
    MESSAGE_DISPLAY_DEFAULT: 'clean',
    COLLAPSE_DISPLAY: 'collapse_previews',
    COLLAPSE_DISPLAY_DEFAULT: 'false',
    USE_MILITARY_TIME: 'use_military_time',
    CATEGORY_THEME: 'theme',
    CATEGORY_FLAGGED_POST: 'flagged_post',
    CATEGORY_NOTIFICATIONS: 'notifications',
    CATEGORY_FAVORITE_CHANNEL: 'favorite_channel',
    EMAIL_INTERVAL: 'email_interval',
    INTERVAL_IMMEDIATE: 30, // "immediate" is a 30 second interval
    INTERVAL_FIFTEEN_MINUTES: 15 * 60,
    INTERVAL_HOUR: 60 * 60
};

export const ActionTypes = keyMirror({
    RECEIVED_ERROR: null,

    CLICK_CHANNEL: null,
    CREATE_CHANNEL: null,
    CREATE_POST: null,
    CREATE_COMMENT: null,
    POST_DELETED: null,
    REMOVE_POST: null,

    RECEIVED_CHANNELS: null,
    RECEIVED_CHANNEL: null,
    RECEIVED_CHANNEL_MEMBER: null,
    RECEIVED_MORE_CHANNELS: null,
    RECEIVED_CHANNEL_STATS: null,
    RECEIVED_MY_CHANNEL_MEMBERS: null,
    RECEIVED_MEMBERS_IN_CHANNEL: null,

    FOCUS_POST: null,
    RECEIVED_POSTS: null,
    RECEIVED_FOCUSED_POST: null,
    RECEIVED_POST: null,
    RECEIVED_EDIT_POST: null,
    RECEIVED_SEARCH: null,
    RECEIVED_SEARCH_TERM: null,
    SELECT_POST: null,
    RECEIVED_POST_SELECTED: null,
    RECEIVED_MENTION_DATA: null,
    RECEIVED_ADD_MENTION: null,
    RECEIVED_POST_PINNED: null,
    RECEIVED_POST_UNPINNED: null,
    INCREASE_POST_VISIBILITY: null,
    LOADING_POSTS: null,

    RECEIVED_PROFILES: null,
    RECEIVED_PROFILES_IN_TEAM: null,
    RECEIVED_PROFILES_NOT_IN_TEAM: null,
    RECEIVED_PROFILE: null,
    RECEIVED_PROFILES_IN_CHANNEL: null,
    RECEIVED_PROFILES_NOT_IN_CHANNEL: null,
    RECEIVED_PROFILES_WITHOUT_TEAM: null,
    RECEIVED_ME: null,
    RECEIVED_SESSIONS: null,
    RECEIVED_AUDITS: null,
    RECEIVED_TEAMS: null,
    RECEIVED_STATUSES: null,
    RECEIVED_PREFERENCE: null,
    RECEIVED_PREFERENCES: null,
    DELETED_PREFERENCES: null,
    RECEIVED_FILE_INFOS: null,
    RECEIVED_ANALYTICS: null,

    RECEIVED_INCOMING_WEBHOOKS: null,
    RECEIVED_INCOMING_WEBHOOK: null,
    UPDATED_INCOMING_WEBHOOK: null,
    REMOVED_INCOMING_WEBHOOK: null,
    RECEIVED_OUTGOING_WEBHOOKS: null,
    RECEIVED_OUTGOING_WEBHOOK: null,
    UPDATED_OUTGOING_WEBHOOK: null,
    REMOVED_OUTGOING_WEBHOOK: null,
    RECEIVED_COMMANDS: null,
    RECEIVED_COMMAND: null,
    UPDATED_COMMAND: null,
    REMOVED_COMMAND: null,
    RECEIVED_OAUTHAPPS: null,
    RECEIVED_OAUTHAPP: null,
    REMOVED_OAUTHAPP: null,

    RECEIVED_CUSTOM_EMOJIS: null,
    RECEIVED_CUSTOM_EMOJI: null,
    UPDATED_CUSTOM_EMOJI: null,
    REMOVED_CUSTOM_EMOJI: null,

    RECEIVED_REACTIONS: null,
    ADDED_REACTION: null,
    REMOVED_REACTION: null,

    RECEIVED_MSG: null,

    RECEIVED_TEAM: null,
    RECEIVED_MY_TEAM: null,
    CREATED_TEAM: null,
    UPDATE_TEAM: null,

    RECEIVED_CONFIG: null,
    RECEIVED_LOGS: null,
    RECEIVED_SERVER_AUDITS: null,
    RECEIVED_SERVER_COMPLIANCE_REPORTS: null,
    RECEIVED_ALL_TEAMS: null,
    RECEIVED_ALL_TEAM_LISTINGS: null,
    RECEIVED_MY_TEAM_MEMBERS: null,
    RECEIVED_MY_TEAMS_UNREAD: null,
    RECEIVED_MEMBERS_IN_TEAM: null,
    RECEIVED_TEAM_STATS: null,

    RECEIVED_LOCALE: null,

    UPDATE_OPEN_GRAPH_METADATA: null,
    RECIVED_OPEN_GRAPH_METADATA: null,

    SHOW_SEARCH: null,

    USER_TYPING: null,

    TOGGLE_ACCOUNT_SETTINGS_MODAL: null,
    TOGGLE_IMPORT_THEME_MODAL: null,
    TOGGLE_INVITE_MEMBER_MODAL: null,
    TOGGLE_LEAVE_TEAM_MODAL: null,
    TOGGLE_DELETE_POST_MODAL: null,
    TOGGLE_GET_POST_LINK_MODAL: null,
    TOGGLE_GET_TEAM_INVITE_LINK_MODAL: null,
    TOGGLE_GET_PUBLIC_LINK_MODAL: null,
    TOGGLE_DM_MODAL: null,
    TOGGLE_QUICK_SWITCH_MODAL: null,
    TOGGLE_CHANNEL_HEADER_UPDATE_MODAL: null,

    SUGGESTION_PRETEXT_CHANGED: null,
    SUGGESTION_RECEIVED_SUGGESTIONS: null,
    SUGGESTION_CLEAR_SUGGESTIONS: null,
    SUGGESTION_COMPLETE_WORD: null,
    SUGGESTION_SELECT_NEXT: null,
    SUGGESTION_SELECT_PREVIOUS: null,

    BROWSER_CHANGE_FOCUS: null,

    EMOJI_POSTED: null
});

export const WebrtcActionTypes = keyMirror({
    INITIALIZE: null,
    NOTIFY: null,
    CHANGED: null,
    ANSWER: null,
    DECLINE: null,
    CANCEL: null,
    NO_ANSWER: null,
    BUSY: null,
    FAILED: null,
    UNSUPPORTED: null,
    MUTED: null,
    IN_PROGRESS: null,
    DISABLED: null,
    RHS: null
});

export const UserStatuses = {
    OFFLINE: 'offline',
    AWAY: 'away',
    ONLINE: 'online'
};

export const UserSearchOptions = {
    ALLOW_INACTIVE: 'allow_inactive',
    WITHOUT_TEAM: 'without_team'
};

export const SocketEvents = {
    POSTED: 'posted',
    POST_EDITED: 'post_edited',
    POST_DELETED: 'post_deleted',
    CHANNEL_CREATED: 'channel_created',
    CHANNEL_DELETED: 'channel_deleted',
    CHANNEL_UPDATED: 'channel_updated',
    CHANNEL_VIEWED: 'channel_viewed',
    DIRECT_ADDED: 'direct_added',
    NEW_USER: 'new_user',
    ADDED_TO_TEAM: 'added_to_team',
    LEAVE_TEAM: 'leave_team',
    UPDATE_TEAM: 'update_team',
    USER_ADDED: 'user_added',
    USER_REMOVED: 'user_removed',
    USER_UPDATED: 'user_updated',
    TYPING: 'typing',
    PREFERENCE_CHANGED: 'preference_changed',
    PREFERENCES_CHANGED: 'preferences_changed',
    PREFERENCES_DELETED: 'preferences_deleted',
    EPHEMERAL_MESSAGE: 'ephemeral_message',
    STATUS_CHANGED: 'status_change',
    HELLO: 'hello',
    WEBRTC: 'webrtc',
    REACTION_ADDED: 'reaction_added',
    REACTION_REMOVED: 'reaction_removed',
    EMOJI_ADDED: 'emoji_added'
};

export const TutorialSteps = {
    INTRO_SCREENS: 0,
    POST_POPOVER: 1,
    CHANNEL_POPOVER: 2,
    MENU_POPOVER: 3
};

export const PostTypes = {
    JOIN_LEAVE: 'system_join_leave',
    JOIN_CHANNEL: 'system_join_channel',
    LEAVE_CHANNEL: 'system_leave_channel',
    ADD_TO_CHANNEL: 'system_add_to_channel',
    REMOVE_FROM_CHANNEL: 'system_remove_from_channel',
    ADD_REMOVE: 'system_add_remove',
    HEADER_CHANGE: 'system_header_change',
    DISPLAYNAME_CHANGE: 'system_displayname_change',
    PURPOSE_CHANGE: 'system_purpose_change',
    CHANNEL_DELETED: 'system_channel_deleted',
    EPHEMERAL: 'system_ephemeral'
};

export const StatTypes = keyMirror({
    TOTAL_USERS: null,
    TOTAL_PUBLIC_CHANNELS: null,
    TOTAL_PRIVATE_GROUPS: null,
    TOTAL_POSTS: null,
    TOTAL_TEAMS: null,
    TOTAL_FILE_POSTS: null,
    TOTAL_HASHTAG_POSTS: null,
    TOTAL_IHOOKS: null,
    TOTAL_OHOOKS: null,
    TOTAL_COMMANDS: null,
    TOTAL_SESSIONS: null,
    POST_PER_DAY: null,
    USERS_WITH_POSTS_PER_DAY: null,
    RECENTLY_ACTIVE_USERS: null,
    NEWLY_CREATED_USERS: null,
    TOTAL_WEBSOCKET_CONNECTIONS: null,
    TOTAL_MASTER_DB_CONNECTIONS: null,
    TOTAL_READ_DB_CONNECTIONS: null,
    DAILY_ACTIVE_USERS: null,
    MONTHLY_ACTIVE_USERS: null
});

export const ErrorPageTypes = {
    LOCAL_STORAGE: 'local_storage'
};

export const ErrorBarTypes = {
    LICENSE_EXPIRING: 'error_bar.license_expiring',
    LICENSE_EXPIRED: 'error_bar.license_expired',
    LICENSE_PAST_GRACE: 'error_bar.past_grace',
    PREVIEW_MODE: 'error_bar.preview_mode',
    SITE_URL: 'error_bar.site_url',
    WEBSOCKET_PORT_ERROR: 'channel_loader.socketError'
};

export const Constants = {
    Preferences,
    SocketEvents,
    ActionTypes,
    WebrtcActionTypes,
    UserStatuses,
    UserSearchOptions,
    TutorialSteps,
    PostTypes,
    ErrorPageTypes,
    ErrorBarTypes,

    MAX_POST_VISIBILITY: 1000000,

    IGNORE_POST_TYPES: [PostTypes.JOIN_LEAVE, PostTypes.JOIN_CHANNEL, PostTypes.LEAVE_CHANNEL, PostTypes.REMOVE_FROM_CHANNEL, PostTypes.ADD_TO_CHANNEL, PostTypes.ADD_REMOVE],

    PayloadSources: keyMirror({
        SERVER_ACTION: null,
        VIEW_ACTION: null
    }),

    StatTypes,
    STAT_MAX_ACTIVE_USERS: 20,
    STAT_MAX_NEW_USERS: 20,

    UserUpdateEvents: {
        USERNAME: 'username',
        FULLNAME: 'fullname',
        NICKNAME: 'nickname',
        EMAIL: 'email',
        LANGUAGE: 'language',
        POSITION: 'position'
    },

    ScrollTypes: {
        FREE: 1,
        BOTTOM: 2,
        SIDEBBAR_OPEN: 3,
        NEW_MESSAGE: 4,
        POST: 5
    },

    SPECIAL_MENTIONS: ['all', 'channel', 'here'],
    NOTIFY_ALL_MEMBERS: 5,
    CHARACTER_LIMIT: 4000,
    IMAGE_TYPES: ['jpg', 'gif', 'bmp', 'png', 'jpeg'],
    AUDIO_TYPES: ['mp3', 'wav', 'wma', 'm4a', 'flac', 'aac', 'ogg'],
    VIDEO_TYPES: ['mp4', 'avi', 'webm', 'mkv', 'wmv', 'mpg', 'mov', 'flv'],
    PRESENTATION_TYPES: ['ppt', 'pptx'],
    SPREADSHEET_TYPES: ['xlsx', 'csv'],
    WORD_TYPES: ['doc', 'docx'],
    CODE_TYPES: ['as', 'applescript', 'osascript', 'scpt', 'bash', 'sh', 'zsh', 'clj', 'boot', 'cl2', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', 'hic', 'coffee', '_coffee', 'cake', 'cjsx', 'cson', 'iced', 'cpp', 'c', 'cc', 'h', 'c++', 'h++', 'hpp', 'cs', 'csharp', 'css', 'd', 'di', 'dart', 'delphi', 'dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm', 'diff', 'django', 'jinja', 'dockerfile', 'docker', 'erl', 'f90', 'f95', 'fsharp', 'fs', 'gcode', 'nc', 'go', 'groovy', 'handlebars', 'hbs', 'html.hbs', 'html.handlebars', 'hs', 'hx', 'java', 'jsp', 'js', 'jsx', 'json', 'jl', 'kt', 'ktm', 'kts', 'less', 'lisp', 'lua', 'mk', 'mak', 'md', 'mkdown', 'mkd', 'matlab', 'm', 'mm', 'objc', 'obj-c', 'ml', 'perl', 'pl', 'php', 'php3', 'php4', 'php5', 'php6', 'ps', 'ps1', 'pp', 'py', 'gyp', 'r', 'ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb', 'rs', 'scala', 'scm', 'sld', 'scss', 'st', 'sql', 'swift', 'tex', 'txt', 'vbnet', 'vb', 'bas', 'vbs', 'v', 'veo', 'xml', 'html', 'xhtml', 'rss', 'atom', 'xsl', 'plist', 'yaml'],
    PDF_TYPES: ['pdf'],
    PATCH_TYPES: ['patch'],
    SVG_TYPES: ['svg'],
    ICON_FROM_TYPE: {
        audio: audioIcon,
        video: videoIcon,
        spreadsheet: excelIcon,
        presentation: pptIcon,
        pdf: pdfIcon,
        code: codeIcon,
        word: wordIcon,
        patch: patchIcon,
        other: genericIcon
    },
    ICON_NAME_FROM_TYPE: {
        audio: 'audio',
        video: 'video',
        spreadsheet: 'excel',
        presentation: 'ppt',
        pdf: 'pdf',
        code: 'code',
        word: 'word',
        patch: 'patch',
        other: 'generic'
    },
    MAX_DISPLAY_FILES: 5,
    MAX_UPLOAD_FILES: 5,
    THUMBNAIL_WIDTH: 128,
    THUMBNAIL_HEIGHT: 100,
    PROFILE_WIDTH: 128,
    PROFILE_HEIGHT: 128,
    WEB_VIDEO_WIDTH: 640,
    WEB_VIDEO_HEIGHT: 480,
    MOBILE_VIDEO_WIDTH: 480,
    MOBILE_VIDEO_HEIGHT: 360,
    MOBILE_SCREEN_WIDTH: 768,
    SCROLL_DELAY: 2000,
    SCROLL_PAGE_FRACTION: 3,
    DEFAULT_CHANNEL: 'town-square',
    DEFAULT_CHANNEL_UI_NAME: 'Town Square',
    OFFTOPIC_CHANNEL: 'off-topic',
    OFFTOPIC_CHANNEL_UI_NAME: 'Off-Topic',
    GITLAB_SERVICE: 'gitlab',
    GOOGLE_SERVICE: 'google',
    OFFICE365_SERVICE: 'office365',
    EMAIL_SERVICE: 'email',
    LDAP_SERVICE: 'ldap',
    SAML_SERVICE: 'saml',
    USERNAME_SERVICE: 'username',
    SIGNIN_CHANGE: 'signin_change',
    PASSWORD_CHANGE: 'password_change',
    SIGNIN_VERIFIED: 'verified',
    SESSION_EXPIRED: 'expired',
    POST_CHUNK_SIZE: 60,
    PROFILE_CHUNK_SIZE: 100,
    POST_FOCUS_CONTEXT_RADIUS: 10,
    POST_LOADING: 'loading',
    POST_FAILED: 'failed',
    POST_DELETED: 'deleted',
    SYSTEM_MESSAGE_PREFIX: 'system_',
    SYSTEM_MESSAGE_PROFILE_IMAGE: logoImage,
    RESERVED_TEAM_NAMES: [
        'signup',
        'login',
        'admin',
        'channel',
        'post',
        'api',
        'oauth'
    ],
    RESERVED_USERNAMES: [
        'valet',
        'all',
        'channel',
        'here',
        'matterbot'
    ],
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    MAX_DMS: 20,
    MAX_USERS_IN_GM: 8,
    MIN_USERS_IN_GM: 3,
    MAX_CHANNEL_POPOVER_COUNT: 100,
    DM_CHANNEL: 'D',
    GM_CHANNEL: 'G',
    OPEN_CHANNEL: 'O',
    PRIVATE_CHANNEL: 'P',
    INVITE_TEAM: 'I',
    OPEN_TEAM: 'O',
    MAX_POST_LEN: 4000,
    EMOJI_SIZE: 16,
    MEMBERS_ICON_SVG: "<svg width='16px' height='16px' viewBox='0 0 16 16' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g id='Symbols' stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g id='Channel-Header/Web-HD' transform='translate(-725.000000, -32.000000)' fill-rule='nonzero' fill='inherit'> <g id='Channel-Header'> <g id='user-count' transform='translate(676.000000, 22.000000)'> <path d='M64.9481342,24 C64.6981342,20.955 63.2551342,19.076 60.6731342,18.354 C61.4831342,17.466 61.9881342,16.296 61.9881342,15 C61.9881342,12.238 59.7501342,10 56.9881342,10 C54.2261342,10 51.9881342,12.238 51.9881342,15 C51.9881342,16.297 52.4941342,17.467 53.3031342,18.354 C50.7221342,19.076 49.2771342,20.955 49.0271342,24 C49.0161342,24.146 49.0061342,24.577 49.0001342,25.001 C48.9911342,25.553 49.4361342,26 49.9881342,26 L63.9881342,26 C64.5411342,26 64.9851342,25.553 64.9761342,25.001 C64.9701342,24.577 64.9601342,24.146 64.9481342,24 Z M56.9881342,12 C58.6421342,12 59.9881342,13.346 59.9881342,15 C59.9881342,16.654 58.6421342,18 56.9881342,18 C55.3341342,18 53.9881342,16.654 53.9881342,15 C53.9881342,13.346 55.3341342,12 56.9881342,12 Z M51.0321342,24 C51.2981342,21.174 52.7911342,20 55.9881342,20 L57.9881342,20 C61.1851342,20 62.6781342,21.174 62.9441342,24 L51.0321342,24 Z' id='User_4_x2C__Profile_5-Copy-9'></path> </g> </g> </g> </g> </svg>",
    TEAM_INFO_SVG: "<svg width='100%' height='100%' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:1.41421;'> <g transform='matrix(1.17647,0,0,1.17647,-1.55431e-15,-1.00573e-14)'> <path d='M8.5,0C3.797,0 0,3.797 0,8.5C0,13.203 3.797,17 8.5,17C13.203,17 17,13.203 17,8.5C17,3.797 13.203,0 8.5,0ZM10,8.5C10,7.672 9.328,7 8.5,7C7.672,7 7,7.672 7,8.5L7,12.45C7,13.278 7.672,13.95 8.5,13.95C9.328,13.95 10,13.278 10,12.45L10,8.5ZM8.5,3C9.328,3 10,3.672 10,4.5C10,5.328 9.328,6 8.5,6C7.672,6 7,5.328 7,4.5C7,3.672 7.672,3 8.5,3Z'/> </g> </svg>",
    FLAG_ICON_OUTLINE_SVG: "<svg width='12px' height='12px' viewBox='0 0 48 48' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.41421;'> <g> <g transform='matrix(1,0,0,0.957537,-0.5,1.42123)'> <path d='M2.5,0.5C1.4,0.5 0.5,1.4 0.5,2.5L0.5,45.6C0.5,46.7 1.4,47.6 2.5,47.6C3.6,47.6 4.5,46.7 4.5,45.6L4.5,2.5C4.4,1.4 3.5,0.5 2.5,0.5Z'/> </g> <g transform='matrix(0.923469,0,0,0.870026,1.64285,2.0085)'> <path d='M46.4,3.5C43.3,2.1 40.1,1.4 36.5,1.4C32.1,1.4 27.8,2.4 23.6,3.4C19.4,4.4 15.5,5.3 11.6,5.3C10.5,5.3 9.4,5.2 8.4,5.1L8.4,37C9.4,37.1 10.5,37.2 11.6,37.2C16,37.2 20.3,36.2 24.5,35.2C28.7,34.2 32.6,33.3 36.5,33.3C39.5,33.3 42.3,33.9 44.8,35.1C45.4,35.4 46.1,35.3 46.7,35C47.3,34.6 47.6,34 47.6,33.3L47.6,5.3C47.5,4.6 47.1,3.9 46.4,3.5Z' style='stroke-width:3.23px; fill:none;'/> </g> </g> </svg>",
    FLAG_ICON_SVG: "<svg width='16px' height='16px' viewBox='0 0 16 16' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-1106.000000, -33.000000)' fill-rule='nonzero' fill='inherit'> <g> <g transform='translate(1096.000000, 22.000000)'> <g transform='translate(10.000000, 11.000000)'> <path d='M8,1 L2,1 C2,0.447 1.553,0 1,0 C0.447,0 0,0.447 0,1 L0,15.5 C0,15.776 0.224,16 0.5,16 L1.5,16 C1.776,16 2,15.776 2,15.5 L2,11 L7,11 L7,12 C7,12.553 7.447,13 8,13 L15,13 C15.553,13 16,12.553 16,12 L16,4 C16,3.447 15.553,3 15,3 L9,3 L9,2 C9,1.447 8.553,1 8,1 Z M9,11 L9,9.5 C9,9.224 8.776,9 8.5,9 L2,9 L2,3 L7,3 L7,4.5 C7,4.776 7.224,5 7.5,5 L14,5 L14,11 L9,11 Z'></path> </g> </g> </g> </g> </g> </svg>",
    ATTACHMENT_ICON_SVG: "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.1' x='0px' y='0px' viewBox='0 0 48 48' enable-background='new 0 0 48 48' xml:space='preserve'><g><path d='M43.922,6.653c-2.643-2.644-6.201-4.107-9.959-4.069c-3.774,0.019-7.32,1.497-9.983,4.161l-12.3,12.3l-8.523,8.521   c-4.143,4.144-4.217,10.812-0.167,14.862c1.996,1.996,4.626,2.989,7.277,2.989c2.73,0,5.482-1.055,7.583-3.156l15.547-15.545   c0.002-0.002,0.002-0.004,0.004-0.005l5.358-5.358c1.394-1.393,2.176-3.24,2.201-5.2c0.026-1.975-0.716-3.818-2.09-5.192   c-2.834-2.835-7.496-2.787-10.394,0.108L9.689,29.857c-0.563,0.563-0.563,1.474,0,2.036c0.281,0.28,0.649,0.421,1.018,0.421   c0.369,0,0.737-0.141,1.018-0.421l18.787-18.788c1.773-1.774,4.609-1.824,6.322-0.11c0.82,0.82,1.263,1.928,1.247,3.119   c-0.017,1.205-0.497,2.342-1.357,3.201l-5.55,5.551c-0.002,0.002-0.002,0.004-0.004,0.005L15.814,40.225   c-3.02,3.02-7.86,3.094-10.789,0.167c-2.928-2.929-2.854-7.77,0.167-10.791l0.958-0.958c0.001-0.002,0.004-0.002,0.005-0.004   L26.016,8.78c2.123-2.124,4.951-3.303,7.961-3.317c2.998,0.02,5.814,1.13,7.91,3.226c4.35,4.351,4.309,11.472-0.093,15.873   L25.459,40.895c-0.563,0.562-0.563,1.473,0,2.035c0.281,0.281,0.65,0.422,1.018,0.422c0.369,0,0.737-0.141,1.018-0.422   L43.83,26.596C49.354,21.073,49.395,12.126,43.922,6.653z'></path></g></svg>",
    MATTERMOST_ICON_SVG: "<svg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'viewBox='0 0 500 500' style='enable-background:new 0 0 500 500;' xml:space='preserve'> <style type='text/css'> .st0{fill-rule:evenodd;clip-rule:evenodd;fill:#222222;} </style> <g id='XMLID_1_'> <g id='XMLID_3_'> <path id='XMLID_4_' class='st0' d='M396.9,47.7l2.6,53.1c43,47.5,60,114.8,38.6,178.1c-32,94.4-137.4,144.1-235.4,110.9 S51.1,253.1,83,158.7C104.5,95.2,159.2,52,222.5,40.5l34.2-40.4C150-2.8,49.3,63.4,13.3,169.9C-31,300.6,39.1,442.5,169.9,486.7 s272.6-25.8,316.9-156.6C522.7,223.9,483.1,110.3,396.9,47.7z'/> </g> <path id='XMLID_2_' class='st0' d='M335.6,204.3l-1.8-74.2l-1.5-42.7l-1-37c0,0,0.2-17.8-0.4-22c-0.1-0.9-0.4-1.6-0.7-2.2 c0-0.1-0.1-0.2-0.1-0.3c0-0.1-0.1-0.2-0.1-0.2c-0.7-1.2-1.8-2.1-3.1-2.6c-1.4-0.5-2.9-0.4-4.2,0.2c0,0-0.1,0-0.1,0 c-0.2,0.1-0.3,0.1-0.4,0.2c-0.6,0.3-1.2,0.7-1.8,1.3c-3,3-13.7,17.2-13.7,17.2l-23.2,28.8l-27.1,33l-46.5,57.8 c0,0-21.3,26.6-16.6,59.4s29.1,48.7,48,55.1c18.9,6.4,48,8.5,71.6-14.7C336.4,238.4,335.6,204.3,335.6,204.3z'/> </g> </svg>",
    ONLINE_AVATAR_SVG: "<svg version='1.1'id='Layer_1' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:svg='http://www.w3.org/2000/svg' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns:cc='http://creativecommons.org/ns#' inkscape:version='0.48.4 r9939' sodipodi:docname='TRASH_1_4.svg'xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='-243 245 12 12'style='enable-background:new -243 245 12 12;' xml:space='preserve'> <sodipodi:namedview  inkscape:cx='26.358185' inkscape:zoom='1.18' bordercolor='#666666' pagecolor='#ffffff' borderopacity='1' objecttolerance='10' inkscape:cy='139.7898' gridtolerance='10' guidetolerance='10' showgrid='false' showguides='true' id='namedview6' inkscape:pageopacity='0' inkscape:pageshadow='2' inkscape:guide-bbox='true' inkscape:window-width='1366' inkscape:current-layer='Layer_1' inkscape:window-height='705' inkscape:window-y='-8' inkscape:window-maximized='1' inkscape:window-x='-8'> <sodipodi:guide  position='50.036793,85.991376' orientation='1,0' id='guide2986'></sodipodi:guide> <sodipodi:guide  position='58.426196,66.216355' orientation='0,1' id='guide3047'></sodipodi:guide> </sodipodi:namedview> <g> <path class='online--icon' d='M-236,250.5C-236,250.5-236,250.5-236,250.5C-236,250.5-236,250.5-236,250.5C-236,250.5-236,250.5-236,250.5z'/> <ellipse class='online--icon' cx='-238.5' cy='248' rx='2.5' ry='2.5'/> </g> <path class='online--icon' d='M-238.9,253.8c0-0.4,0.1-0.9,0.2-1.3c-2.2-0.2-2.2-2-2.2-2s-1,0.1-1.2,0.5c-0.4,0.6-0.6,1.7-0.7,2.5c0,0.1-0.1,0.5,0,0.6 c0.2,1.3,2.2,2.3,4.4,2.4c0,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0C-238.7,255.7-238.9,254.8-238.9,253.8z'/> <g> <g> <path class='online--icon' d='M-232.3,250.1l1.3,1.3c0,0,0,0.1,0,0.1l-4.1,4.1c0,0,0,0-0.1,0c0,0,0,0,0,0l-2.7-2.7c0,0,0-0.1,0-0.1l1.2-1.2 c0,0,0.1,0,0.1,0l1.4,1.4l2.9-2.9C-232.4,250.1-232.3,250.1-232.3,250.1z'/> </g> </g> </svg>",
    AWAY_AVATAR_SVG: "<svg version='1.1'id='Layer_1' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:svg='http://www.w3.org/2000/svg' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns:cc='http://creativecommons.org/ns#' inkscape:version='0.48.4 r9939' sodipodi:docname='TRASH_1_4.svg'xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='-299 391 12 12'style='enable-background:new -299 391 12 12;' xml:space='preserve'> <sodipodi:namedview  inkscape:cx='26.358185' inkscape:zoom='1.18' bordercolor='#666666' pagecolor='#ffffff' borderopacity='1' objecttolerance='10' inkscape:cy='139.7898' gridtolerance='10' guidetolerance='10' showgrid='false' showguides='true' id='namedview6' inkscape:pageopacity='0' inkscape:pageshadow='2' inkscape:guide-bbox='true' inkscape:window-width='1366' inkscape:current-layer='Layer_1' inkscape:window-height='705' inkscape:window-y='-8' inkscape:window-maximized='1' inkscape:window-x='-8'> <sodipodi:guide  position='50.036793,85.991376' orientation='1,0' id='guide2986'></sodipodi:guide> <sodipodi:guide  position='58.426196,66.216355' orientation='0,1' id='guide3047'></sodipodi:guide> </sodipodi:namedview> <g> <ellipse class='away--icon' cx='-294.6' cy='394' rx='2.5' ry='2.5'/> <path class='away--icon' d='M-293.8,399.4c0-0.4,0.1-0.7,0.2-1c-0.3,0.1-0.6,0.2-1,0.2c-2.5,0-2.5-2-2.5-2s-1,0.1-1.2,0.5c-0.4,0.6-0.6,1.7-0.7,2.5 c0,0.1-0.1,0.5,0,0.6c0.2,1.3,2.2,2.3,4.4,2.4c0,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0c0.7,0,1.4-0.1,2-0.3 C-293.3,401.5-293.8,400.5-293.8,399.4z'/> </g> <path class='away--icon' d='M-287,400c0,0.1-0.1,0.1-0.1,0.1l-4.9,0c-0.1,0-0.1-0.1-0.1-0.1v-1.6c0-0.1,0.1-0.1,0.1-0.1l4.9,0c0.1,0,0.1,0.1,0.1,0.1 V400z'/> </svg>",
    OFFLINE_AVATAR_SVG: "<svg version='1.1'id='Layer_1' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:svg='http://www.w3.org/2000/svg' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns:cc='http://creativecommons.org/ns#' inkscape:version='0.48.4 r9939' sodipodi:docname='TRASH_1_4.svg'xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='-299 391 12 12'style='enable-background:new -299 391 12 12;' xml:space='preserve'> <sodipodi:namedview  inkscape:cx='26.358185' inkscape:zoom='1.18' bordercolor='#666666' pagecolor='#ffffff' borderopacity='1' objecttolerance='10' inkscape:cy='139.7898' gridtolerance='10' guidetolerance='10' showgrid='false' showguides='true' id='namedview6' inkscape:pageopacity='0' inkscape:pageshadow='2' inkscape:guide-bbox='true' inkscape:window-width='1366' inkscape:current-layer='Layer_1' inkscape:window-height='705' inkscape:window-y='-8' inkscape:window-maximized='1' inkscape:window-x='-8'> <sodipodi:guide  position='50.036793,85.991376' orientation='1,0' id='guide2986'></sodipodi:guide> <sodipodi:guide  position='58.426196,66.216355' orientation='0,1' id='guide3047'></sodipodi:guide> </sodipodi:namedview> <g> <g> <ellipse class='offline--icon' cx='-294.5' cy='394' rx='2.5' ry='2.5'/> <path class='offline--icon' d='M-294.3,399.7c0-0.4,0.1-0.8,0.2-1.2c-0.1,0-0.2,0-0.4,0c-2.5,0-2.5-2-2.5-2s-1,0.1-1.2,0.5c-0.4,0.6-0.6,1.7-0.7,2.5 c0,0.1-0.1,0.5,0,0.6c0.2,1.3,2.2,2.3,4.4,2.4h0.1h0.1c0.3,0,0.7,0,1-0.1C-293.9,401.6-294.3,400.7-294.3,399.7z'/> </g> </g> <g> <path class='offline--icon' d='M-288.9,399.4l1.8-1.8c0.1-0.1,0.1-0.3,0-0.3l-0.7-0.7c-0.1-0.1-0.3-0.1-0.3,0l-1.8,1.8l-1.8-1.8c-0.1-0.1-0.3-0.1-0.3,0 l-0.7,0.7c-0.1,0.1-0.1,0.3,0,0.3l1.8,1.8l-1.8,1.8c-0.1,0.1-0.1,0.3,0,0.3l0.7,0.7c0.1,0.1,0.3,0.1,0.3,0l1.8-1.8l1.8,1.8 c0.1,0.1,0.3,0.1,0.3,0l0.7-0.7c0.1-0.1,0.1-0.3,0-0.3L-288.9,399.4z'/> </g> </svg>",
    ONLINE_ICON_SVG: "<div class='icon__container'><svg width='100%' height='100%' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:1.41421;'><path class='online--icon' d='M10,0c5.519,0 10,4.481 10,10c0,5.519 -4.481,10 -10,10c-5.519,0 -10,-4.481 -10,-10c0,-5.519 4.481,-10 10,-10Zm6.19,7.18c0,0.208 -0.075,0.384 -0.224,0.53l-5.782,5.64l-1.087,1.059c-0.149,0.146 -0.33,0.218 -0.543,0.218c-0.213,0 -0.394,-0.072 -0.543,-0.218l-1.086,-1.059l-2.891,-2.82c-0.149,-0.146 -0.224,-0.322 -0.224,-0.53c0,-0.208 0.075,-0.384 0.224,-0.53l1.086,-1.059c0.149,-0.146 0.33,-0.218 0.543,-0.218c0.213,0 0.394,0.072 0.543,0.218l2.348,2.298l5.24,-5.118c0.149,-0.146 0.33,-0.218 0.543,-0.218c0.213,0 0.394,0.072 0.543,0.218l1.086,1.059c0.149,0.146 0.224,0.322 0.224,0.53Z'/></svg></div>",
    AWAY_ICON_SVG: "<div class='icon__container'><svg width='100%' height='100%' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:1.41421;'><path class='away--icon' d='M10,0c5.519,0 10,4.481 10,10c0,5.519 -4.481,10 -10,10c-5.519,0 -10,-4.481 -10,-10c0,-5.519 4.481,-10 10,-10Zm5.25,8.5l-10.5,0c-0.414,0 -0.75,0.336 -0.75,0.75l0,1.5c0,0.414 0.336,0.75 0.75,0.75l10.5,0c0.414,0 0.75,-0.336 0.75,-0.75l0,-1.5c0,-0.414 -0.336,-0.75 -0.75,-0.75Z'/></svg></div>",
    OFFLINE_ICON_SVG: "<svg class='offline--icon' width='100%' height='100%' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:1.41421;'><path d='M10,0c5.519,0 10,4.481 10,10c0,5.519 -4.481,10 -10,10c-5.519,0 -10,-4.481 -10,-10c0,-5.519 4.481,-10 10,-10Zm0,2c4.415,0 8,3.585 8,8c0,4.415 -3.585,8 -8,8c-4.415,0 -8,-3.585 -8,-8c0,-4.415 3.585,-8 8,-8Z'/></svg>",
    MENU_ICON: "<svg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'width='4px' height='16px' viewBox='0 0 8 32' enable-background='new 0 0 8 32' xml:space='preserve'> <g> <circle cx='4' cy='4.062' r='4'/> <circle cx='4' cy='16' r='4'/> <circle cx='4' cy='28' r='4'/> </g> </svg>",
    COMMENT_ICON: "<svg version='1.1' id='Layer_2' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'width='15px' height='15px' viewBox='1 1.5 15 15' enable-background='new 1 1.5 15 15' xml:space='preserve'> <g> <g> <path fill='#211B1B' d='M14,1.5H3c-1.104,0-2,0.896-2,2v8c0,1.104,0.896,2,2,2h1.628l1.884,3l1.866-3H14c1.104,0,2-0.896,2-2v-8 C16,2.396,15.104,1.5,14,1.5z M15,11.5c0,0.553-0.447,1-1,1H8l-1.493,2l-1.504-1.991L5,12.5H3c-0.552,0-1-0.447-1-1v-8 c0-0.552,0.448-1,1-1h11c0.553,0,1,0.448,1,1V11.5z'/> </g> </g> </svg>",
    REPLY_ICON: "<svg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'viewBox='-158 242 18 18' style='enable-background:new -158 242 18 18;' xml:space='preserve'> <path d='M-142.2,252.6c-2-3-4.8-4.7-8.3-4.8v-3.3c0-0.2-0.1-0.3-0.2-0.3s-0.3,0-0.4,0.1l-6.9,6.2c-0.1,0.1-0.1,0.2-0.1,0.3 c0,0.1,0,0.2,0.1,0.3l6.9,6.4c0.1,0.1,0.3,0.1,0.4,0.1c0.1-0.1,0.2-0.2,0.2-0.4v-3.8c4.2,0,7.4,0.4,9.6,4.4c0.1,0.1,0.2,0.2,0.3,0.2 c0,0,0.1,0,0.1,0c0.2-0.1,0.3-0.3,0.2-0.4C-140.2,257.3-140.6,255-142.2,252.6z M-150.8,252.5c-0.2,0-0.4,0.2-0.4,0.4v3.3l-6-5.5 l6-5.3v2.8c0,0.2,0.2,0.4,0.4,0.4c3.3,0,6,1.5,8,4.5c0.5,0.8,0.9,1.6,1.2,2.3C-144,252.8-147.1,252.5-150.8,252.5z'/> </svg>",
    SCROLL_BOTTOM_ICON: "<svg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'viewBox='-239 239 21 23' style='enable-background:new -239 239 21 23;' xml:space='preserve'> <path d='M-239,241.4l2.4-2.4l8.1,8.2l8.1-8.2l2.4,2.4l-10.5,10.6L-239,241.4z M-228.5,257.2l8.1-8.2l2.4,2.4l-10.5,10.6l-10.5-10.6 l2.4-2.4L-228.5,257.2z'/> </svg>",
    VIDEO_ICON: "<svg width='16px' height='12px' viewBox='0 0 16 12' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-696.000000, -34.000000)' fill-rule='nonzero' fill='inherit'> <g transform='translate(-1.000000, 0.000000)'> <g transform='translate(687.000000, 22.000000)'> <g transform='translate(10.000000, 12.000000)'> <path d='M15.105,1.447 L12,3 L12,1 C12,0.447 11.553,0 11,0 L1,0 C0.447,0 0,0.447 0,1 L0,11 C0,11.553 0.447,12 1,12 L11,12 C11.553,12 12,11.553 12,11 L12,9 L15.105,10.553 C15.6,10.8 16,10.553 16,10 L16,2 C16,1.447 15.6,1.2 15.105,1.447 Z M12.895,7.211 C12.612,7.07 12.306,7 12,7 L10.5,7 C10.224,7 10,7.224 10,7.5 L10,10 L2,10 L2,2 L10,2 L10,4.5 C10,4.776 10.224,5 10.5,5 L12,5 C12.306,5 12.612,4.93 12.895,4.789 L14,4.236 L14,7.763 L12.895,7.211 Z'></path> </g> </g> </g> </g> </g> </svg>",
    PIN_ICON_SVG: "<svg width='16px' height='16px' viewBox='0 0 16 16' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g id='Symbols' stroke='inherit' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-775.000000, -32.000000)' fill-rule='nonzero' fill='inherit'> <g> <g transform='translate(764.000000, 22.000000)'> <g transform='translate(10.000000, 10.000000)'> <path d='M16.456,7.291 L9.483,0.25 C9.31,0.078 9.178,0 9.08,0 C8.896,0 8.831,0.276 8.831,0.732 L8.831,3.044 L5.831,5.96 L2.578,6.268 C1.887,6.405 1.668,6.917 2.167,7.41 L4.781,10.011 L3.83,10.961 L1.05,15.511 C0.93,15.761 1.03,15.862 1.28,15.74 L5.83,12.961 L6.786,12.005 L9.359,14.565 C9.556,14.76 9.754,14.854 9.929,14.854 C10.197,14.854 10.413,14.634 10.497,14.219 L10.83,10.961 L13.746,7.961 L16.082,7.961 C16.788,7.961 16.955,7.785 16.456,7.291 Z M12.312,6.567 L9.396,9.567 L8.911,10.065 L8.84,10.757 L8.797,11.184 L5.589,7.992 L6.018,7.952 L6.72,7.886 L7.225,7.396 L10.225,4.48 L10.547,4.167 L12.616,6.256 L12.312,6.567 Z'></path> </g> </g> </g> </g> </g> </svg>",
    LEAVE_TEAM_SVG: "<svg width='100%' height='100%' viewBox='0 0 164 164' version='1.1' xmlns='http://www.w3.org/2000/svg'    xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round; stroke-miterlimit:1.41421;'> <path d='M26.023,164L26.023,7.035L26.022,0.32L137.658,0.32L137.658,164L124.228,164L124.228, 13.749L39.452,13.749L39.452,164L26.023, 164ZM118.876,164L118.876,18.619L58.137,32.918L58.137,149.701L118.876,164Z'/></svg>",
    SEARCH_ICON_SVG: "<svg width='19px' height='18px' viewBox='0 0 19 18' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='inherit' stroke-width='1' fill='none' fill-rule='evenodd'> <g transform='translate(-719.000000, -20.000000)' stroke-width='1.5'> <g transform='translate(0.000000, 1.000000)'> <g transform='translate(63.000000, 10.000000)'> <g transform='translate(657.000000, 10.000000)'> <circle cx='7' cy='7' r='7'></circle> <path d='M12.5,11.5 L16.5,15.5' stroke-linecap='round'></path> </g> </g> </g> </g> </g> </svg>",
    MENTIONS_ICON_SVG: "<svg width='20px' height='20px' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-1057.000000, -31.000000)' fill='inherit'> <g> <g transform='translate(1049.000000, 22.000000)'> <path d='M17.4296875,15.8867188 C15.9882812,15.8867188 15.1210938,17.0351562 15.1210938,18.96875 C15.1210938,20.8789062 15.9882812,22.0507812 17.4179688,22.0507812 C18.8945312,22.0507812 19.84375,20.8554688 19.84375,18.96875 C19.84375,17.0820312 18.90625,15.8867188 17.4296875,15.8867188 Z M17.8398438,9.125 C23.3242188,9.125 27.25,12.59375 27.25,17.7734375 C27.25,21.5117188 25.5625,23.9609375 22.7734375,23.9609375 C21.4023438,23.9609375 20.265625,23.1992188 20.078125,22.0390625 L19.9609375,22.0390625 C19.46875,23.2226562 18.4140625,23.8789062 17.0429688,23.8789062 C14.6054687,23.8789062 12.9648438,21.8867188 12.9648438,18.9101562 C12.9648438,16.0625 14.6171875,14.09375 16.9960938,14.09375 C18.25,14.09375 19.3632812,14.7382812 19.8085938,15.7460938 L19.9375,15.7460938 L19.9375,14.328125 L21.9179688,14.328125 L21.9179688,20.984375 C21.9179688,21.7578125 22.328125,22.2851562 23.171875,22.2851562 C24.4726562,22.2851562 25.421875,20.6679688 25.421875,17.8320312 C25.421875,13.5664062 22.2929688,10.7421875 17.7109375,10.7421875 C13.1640625,10.7421875 9.90625,14.140625 9.90625,18.96875 C9.90625,24.1367188 13.3515625,27.0429688 18.109375,27.0429688 C19.5625,27.0429688 21.0507812,26.84375 21.7773438,26.5390625 L21.7773438,28.15625 C20.78125,28.484375 19.4570312,28.671875 18.0273438,28.671875 C12.2382812,28.671875 8.078125,25.109375 8.078125,18.8984375 C8.078125,13.0625 12.0859375,9.125 17.8398438,9.125 Z'></path> </g> </g> </g></g></svg>",
    MENU_ICON_SVG: "<svg width='16px' height='10px' viewBox='0 0 16 10' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-26.000000, -24.000000)' fill-rule='nonzero' fill='inherit'> <g transform='translate(26.000000, 24.000000)'> <path d='M1.5,0 L0.5,0 C0.224,0 0,0.224 0,0.5 L0,1.5 C0,1.776 0.224,2 0.5,2 L1.5,2 C1.776,2 2,1.776 2,1.5 L2,0.5 C2,0.224 1.776,0 1.5,0 Z'></path> <path d='M15.5,0 L3.5,0 C3.224,0 3,0.224 3,0.5 L3,1.5 C3,1.776 3.224,2 3.5,2 L15.5,2 C15.776,2 16,1.776 16,1.5 L16,0.5 C16,0.224 15.776,0 15.5,0 Z'></path> <path d='M1.5,4 L0.5,4 C0.224,4 0,4.224 0,4.5 L0,5.5 C0,5.776 0.224,6 0.5,6 L1.5,6 C1.776,6 2,5.776 2,5.5 L2,4.5 C2,4.224 1.776,4 1.5,4 Z'></path> <path d='M3.5,6 L11.5,6 C11.776,6 12,5.776 12,5.5 L12,4.5 C12,4.224 11.776,4 11.5,4 L3.5,4 C3.224,4 3,4.224 3,4.5 L3,5.5 C3,5.776 3.224,6 3.5,6 Z'></path> <path d='M1.5,8 L0.5,8 C0.224,8 0,8.224 0,8.5 L0,9.5 C0,9.776 0.224,10 0.5,10 L1.5,10 C1.776,10 2,9.776 2,9.5 L2,8.5 C2,8.224 1.776,8 1.5,8 Z'></path> <path d='M13.5,8 L3.5,8 C3.224,8 3,8.224 3,8.5 L3,9.5 C3,9.776 3.224,10 3.5,10 L13.5,10 C13.776,10 14,9.776 14,9.5 L14,8.5 C14,8.224 13.776,8 13.5,8 Z'></path> </g> </g> </g> </svg>",
    INFO_ICON_SVG: "<svg width='22px' height='22px' viewBox='0 0 22 22' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-388.000000, -18.000000)' fill='inherit'> <g> <g transform='translate(381.000000, 11.000000)'> <g transform='translate(7.000000, 7.000000)'> <path d='M11,22 C4.92486775,22 0,17.0751322 0,11 C0,4.92486775 4.92486775,0 11,0 C17.0751322,0 22,4.92486775 22,11 C22,17.0751322 17.0751322,22 11,22 Z M11,20.7924685 C16.408231,20.7924685 20.7924685,16.408231 20.7924685,11 C20.7924685,5.59176898 16.408231,1.20753149 11,1.20753149 C5.59176898,1.20753149 1.20753149,5.59176898 1.20753149,11 C1.20753149,16.408231 5.59176898,20.7924685 11,20.7924685 Z M10.1572266,16.0625 L10.1572266,8.69335938 L11.3466797,8.69335938 L11.3466797,16.0625 L10.1572266,16.0625 Z M10.7519531,7.50390625 C10.3417969,7.50390625 10,7.16210938 10,6.75195312 C10,6.33496094 10.3417969,6 10.7519531,6 C11.1689453,6 11.5039062,6.33496094 11.5039062,6.75195312 C11.5039062,7.16210938 11.1689453,7.50390625 10.7519531,7.50390625 Z'></path> </g> </g> </g> </g> </g> </svg>",
    MESSAGE_ICON_SVG: "<svg width='16px' height='16px' viewBox='0 0 16 16' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g stroke='none' stroke-width='1' fill='inherit' fill-rule='evenodd'> <g transform='translate(-202.000000, -176.000000)' fill-rule='nonzero' fill='inherit'> <g> <g transform='translate(202.000000, 176.000000)'> <path d='M15,0 C15.553,0 16,0.496 16,1.048 L16,8.048 C16,8.601 15.553,9 15,9 L14,9 L14,7.048 L14,3.048 C14,2.496 13.553,2 13,2 L5,2 L3,2 L3,1.048 C3,0.496 3.447,0 4,0 L15,0 Z M12,3 C12.55,3 13,3.508 13,4.07 L13,12.048 C13,12.61 12.55,13 12,13 L11,13 L11,15.376 C11,15.94 10.596,16.035 10.098,15.791 L4.72,13 L1,13 C0.45,13 0,12.61 0,12.048 L0,4.07 C0,3.508 0.45,3 1,3 L12,3 Z'></path> </g> </g> </g> </g> </svg>",
    THEMES: {
        default: {
            type: 'Organization',
            sidebarBg: '#2071a7',
            sidebarText: '#ffffff',
            sidebarUnreadText: '#ffffff',
            sidebarTextHoverBg: '#136197',
            sidebarTextActiveBorder: '#7ab0d6',
            sidebarTextActiveColor: '#ffffff',
            sidebarHeaderBg: '#2f81b7',
            sidebarHeaderTextColor: '#ffffff',
            onlineIndicator: '#7dbe00',
            awayIndicator: '#dcbd4e',
            mentionBj: '#fbfbfb',
            mentionColor: '#2071f7',
            centerChannelBg: '#f2f4f8',
            centerChannelColor: '#333333',
            newMessageSeparator: '#ff8800',
            linkColor: '#2f81b7',
            buttonBg: '#1dacfc',
            buttonColor: '#ffffff',
            errorTextColor: '#a94442',
            mentionHighlightBg: '#f3e197',
            mentionHighlightLink: '#2f81b7',
            codeTheme: 'github',
            image: defaultThemeImage
        },
        mattermost: {
            type: 'Mattermost',
            sidebarBg: '#fafafa',
            sidebarText: '#333333',
            sidebarUnreadText: '#333333',
            sidebarTextHoverBg: '#e6f2fa',
            sidebarTextActiveBorder: '#378fd2',
            sidebarTextActiveColor: '#111111',
            sidebarHeaderBg: '#3481b9',
            sidebarHeaderTextColor: '#ffffff',
            onlineIndicator: '#7dbe00',
            awayIndicator: '#dcbd4e',
            mentionBj: '#2389d7',
            mentionColor: '#ffffff',
            centerChannelBg: '#ffffff',
            centerChannelColor: '#333333',
            newMessageSeparator: '#ff8800',
            linkColor: '#2389d7',
            buttonBg: '#23a2ff',
            buttonColor: '#ffffff',
            errorTextColor: '#a94442',
            mentionHighlightBg: '#f3e197',
            mentionHighlightLink: '#2f81b7',
            codeTheme: 'github',
            image: mattermostThemeImage
        },
        mattermostDark: {
            type: 'Mattermost Dark',
            sidebarBg: '#1b2c3e',
            sidebarText: '#ffffff',
            sidebarUnreadText: '#ffffff',
            sidebarTextHoverBg: '#4a5664',
            sidebarTextActiveBorder: '#66b9a7',
            sidebarTextActiveColor: '#ffffff',
            sidebarHeaderBg: '#1b2c3e',
            sidebarHeaderTextColor: '#ffffff',
            onlineIndicator: '#65dcc8',
            awayIndicator: '#c1b966',
            mentionBj: '#b74a4a',
            mentionColor: '#ffffff',
            centerChannelBg: '#2f3e4e',
            centerChannelColor: '#dddddd',
            newMessageSeparator: '#5de5da',
            linkColor: '#a4ffeb',
            buttonBg: '#4cbba4',
            buttonColor: '#ffffff',
            errorTextColor: '#ff6461',
            mentionHighlightBg: '#984063',
            mentionHighlightLink: '#a4ffeb',
            codeTheme: 'solarized-dark',
            image: mattermostDarkThemeImage
        },
        windows10: {
            type: 'Windows Dark',
            sidebarBg: '#171717',
            sidebarText: '#ffffff',
            sidebarUnreadText: '#ffffff',
            sidebarTextHoverBg: '#302e30',
            sidebarTextActiveBorder: '#196caf',
            sidebarTextActiveColor: '#ffffff',
            sidebarHeaderBg: '#1f1f1f',
            sidebarHeaderTextColor: '#ffffff',
            onlineIndicator: '#399fff',
            awayIndicator: '#c1b966',
            mentionBj: '#0177e7',
            mentionColor: '#ffffff',
            centerChannelBg: '#1f1f1f',
            centerChannelColor: '#dddddd',
            newMessageSeparator: '#cc992d',
            linkColor: '#0d93ff',
            buttonBg: '#0177e7',
            buttonColor: '#ffffff',
            errorTextColor: '#ff6461',
            mentionHighlightBg: '#784098',
            mentionHighlightLink: '#a4ffeb',
            codeTheme: 'monokai',
            image: windows10ThemeImage
        }
    },
    THEME_ELEMENTS: [
        {
            group: 'sidebarElements',
            id: 'sidebarBg',
            uiName: 'Sidebar BG'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarText',
            uiName: 'Sidebar Text'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarHeaderBg',
            uiName: 'Sidebar Header BG'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarHeaderTextColor',
            uiName: 'Sidebar Header Text'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarUnreadText',
            uiName: 'Sidebar Unread Text'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextHoverBg',
            uiName: 'Sidebar Text Hover BG'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextActiveBorder',
            uiName: 'Sidebar Text Active Border'
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextActiveColor',
            uiName: 'Sidebar Text Active Color'
        },
        {
            group: 'sidebarElements',
            id: 'onlineIndicator',
            uiName: 'Online Indicator'
        },
        {
            group: 'sidebarElements',
            id: 'awayIndicator',
            uiName: 'Away Indicator'
        },
        {
            group: 'sidebarElements',
            id: 'mentionBj',
            uiName: 'Mention Jewel BG'
        },
        {
            group: 'sidebarElements',
            id: 'mentionColor',
            uiName: 'Mention Jewel Text'
        },
        {
            group: 'centerChannelElements',
            id: 'centerChannelBg',
            uiName: 'Center Channel BG'
        },
        {
            group: 'centerChannelElements',
            id: 'centerChannelColor',
            uiName: 'Center Channel Text'
        },
        {
            group: 'centerChannelElements',
            id: 'newMessageSeparator',
            uiName: 'New Message Separator'
        },
        {
            group: 'centerChannelElements',
            id: 'errorTextColor',
            uiName: 'Error Text Color'
        },
        {
            group: 'centerChannelElements',
            id: 'mentionHighlightBg',
            uiName: 'Mention Highlight BG'
        },
        {
            group: 'linkAndButtonElements',
            id: 'linkColor',
            uiName: 'Link Color'
        },
        {
            group: 'centerChannelElements',
            id: 'mentionHighlightLink',
            uiName: 'Mention Highlight Link'
        },
        {
            group: 'linkAndButtonElements',
            id: 'buttonBg',
            uiName: 'Button BG'
        },
        {
            group: 'linkAndButtonElements',
            id: 'buttonColor',
            uiName: 'Button Text'
        },
        {
            group: 'centerChannelElements',
            id: 'codeTheme',
            uiName: 'Code Theme',
            themes: [
                {
                    id: 'solarized-dark',
                    uiName: 'Solarized Dark',
                    cssURL: solarizedDarkCSS,
                    iconURL: solarizedDarkIcon
                },
                {
                    id: 'solarized-light',
                    uiName: 'Solarized Light',
                    cssURL: solarizedLightCSS,
                    iconURL: solarizedLightIcon
                },
                {
                    id: 'github',
                    uiName: 'GitHub',
                    cssURL: githubCSS,
                    iconURL: githubIcon
                },
                {
                    id: 'monokai',
                    uiName: 'Monokai',
                    cssURL: monokaiCSS,
                    iconURL: monokaiIcon
                }
            ]
        }
    ],
    DEFAULT_CODE_THEME: 'github',
    KeyCodes: {
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        CAPS_LOCK: 20,
        ESCAPE: 27,
        SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        INSERT: 45,
        DELETE: 46,
        ZERO: 48,
        ONE: 49,
        TWO: 50,
        THREE: 51,
        FOUR: 52,
        FIVE: 53,
        SIX: 54,
        SEVEN: 55,
        EIGHT: 56,
        NINE: 57,
        A: 65,
        B: 66,
        C: 67,
        D: 68,
        E: 69,
        F: 70,
        G: 71,
        H: 72,
        I: 73,
        J: 74,
        K: 75,
        L: 76,
        M: 77,
        N: 78,
        O: 79,
        P: 80,
        Q: 81,
        R: 82,
        S: 83,
        T: 84,
        U: 85,
        V: 86,
        W: 87,
        X: 88,
        Y: 89,
        Z: 90,
        CMD: 91,
        MENU: 93,
        NUMPAD_0: 96,
        NUMPAD_1: 97,
        NUMPAD_2: 98,
        NUMPAD_3: 99,
        NUMPAD_4: 100,
        NUMPAD_5: 101,
        NUMPAD_6: 102,
        NUMPAD_7: 103,
        NUMPAD_8: 104,
        NUMPAD_9: 105,
        MULTIPLY: 106,
        ADD: 107,
        SUBTRACT: 109,
        DECIMAL: 110,
        DIVIDE: 111,
        F1: 112,
        F2: 113,
        F3: 114,
        F4: 115,
        F5: 116,
        F6: 117,
        F7: 118,
        F8: 119,
        F9: 120,
        F10: 121,
        F11: 122,
        F12: 123,
        NUM_LOCK: 144,
        SEMICOLON: 186,
        EQUAL: 187,
        COMMA: 188,
        DASH: 189,
        PERIOD: 190,
        FORWARD_SLASH: 191,
        TILDE: 192,
        OPEN_BRACKET: 219,
        BACK_SLASH: 220,
        CLOSE_BRACKET: 221
    },
    CODE_PREVIEW_MAX_FILE_SIZE: 500000, // 500 KB
    HighlightedLanguages: {
        actionscript: {name: 'ActionScript', extensions: ['as'], aliases: ['as', 'as3']},
        applescript: {name: 'AppleScript', extensions: ['applescript', 'osascript', 'scpt']},
        bash: {name: 'Bash', extensions: ['bash', 'sh', 'zsh']},
        clojure: {name: 'Clojure', extensions: ['clj', 'boot', 'cl2', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', 'hic']},
        coffeescript: {name: 'CoffeeScript', extensions: ['coffee', '_coffee', 'cake', 'cjsx', 'cson', 'iced'], aliases: ['coffee', 'coffee-script']},
        cpp: {name: 'C/C++', extensions: ['cpp', 'c', 'cc', 'h', 'c++', 'h++', 'hpp'], aliases: ['c++']},
        cs: {name: 'C#', extensions: ['cs', 'csharp'], aliases: ['c#', 'csharp']},
        css: {name: 'CSS', extensions: ['css']},
        d: {name: 'D', extensions: ['d', 'di'], aliases: ['dlang']},
        dart: {name: 'Dart', extensions: ['dart']},
        delphi: {name: 'Delphi', extensions: ['delphi', 'dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm']},
        diff: {name: 'Diff', extensions: ['diff', 'patch'], aliases: ['patch', 'udiff']},
        django: {name: 'Django', extensions: ['django', 'jinja']},
        dockerfile: {name: 'Dockerfile', extensions: ['dockerfile', 'docker'], aliases: ['docker']},
        erlang: {name: 'Erlang', extensions: ['erl'], aliases: ['erl']},
        fortran: {name: 'Fortran', extensions: ['f90', 'f95']},
        fsharp: {name: 'F#', extensions: ['fsharp', 'fs']},
        gcode: {name: 'G-Code', extensions: ['gcode', 'nc']},
        go: {name: 'Go', extensions: ['go'], aliases: ['golang']},
        groovy: {name: 'Groovy', extensions: ['groovy']},
        handlebars: {name: 'Handlebars', extensions: ['handlebars', 'hbs', 'html.hbs', 'html.handlebars'], aliases: ['hbs', 'mustache']},
        haskell: {name: 'Haskell', extensions: ['hs'], aliases: ['hs']},
        haxe: {name: 'Haxe', extensions: ['hx']},
        java: {name: 'Java', extensions: ['java', 'jsp']},
        javascript: {name: 'JavaScript', extensions: ['js', 'jsx'], aliases: ['js']},
        json: {name: 'JSON', extensions: ['json']},
        julia: {name: 'Julia', extensions: ['jl'], aliases: ['jl']},
        kotlin: {name: 'Kotlin', extensions: ['kt', 'ktm', 'kts']},
        less: {name: 'Less', extensions: ['less']},
        lisp: {name: 'Lisp', extensions: ['lisp']},
        lua: {name: 'Lua', extensions: ['lua']},
        makefile: {name: 'Makefile', extensions: ['mk', 'mak'], aliases: ['make', 'mf', 'gnumake', 'bsdmake']},
        markdown: {name: 'Markdown', extensions: ['md', 'mkdown', 'mkd'], aliases: ['md', 'mkd']},
        matlab: {name: 'Matlab', extensions: ['matlab', 'm'], aliases: ['m']},
        objectivec: {name: 'Objective C', extensions: ['mm', 'objc', 'obj-c'], aliases: ['objective_c', 'objc']},
        ocaml: {name: 'OCaml', extensions: ['ml']},
        perl: {name: 'Perl', extensions: ['perl', 'pl'], aliases: ['pl']},
        php: {name: 'PHP', extensions: ['php', 'php3', 'php4', 'php5', 'php6'], aliases: ['php3', 'php4', 'php5']},
        powershell: {name: 'PowerShell', extensions: ['ps', 'ps1'], aliases: ['posh']},
        puppet: {name: 'Puppet', extensions: ['pp'], aliases: ['pp']},
        python: {name: 'Python', extensions: ['py', 'gyp'], aliases: ['py']},
        r: {name: 'R', extensions: ['r'], aliases: ['r', 's']},
        ruby: {name: 'Ruby', extensions: ['ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb'], aliases: ['rb']},
        rust: {name: 'Rust', extensions: ['rs'], aliases: ['rs']},
        scala: {name: 'Scala', extensions: ['scala']},
        scheme: {name: 'Scheme', extensions: ['scm', 'sld']},
        scss: {name: 'SCSS', extensions: ['scss']},
        smalltalk: {name: 'Smalltalk', extensions: ['st'], aliases: ['st', 'squeak']},
        sql: {name: 'SQL', extensions: ['sql']},
        swift: {name: 'Swift', extensions: ['swift']},
        tex: {name: 'TeX', extensions: ['tex'], aliases: ['latex']},
        text: {name: 'Text', extensions: ['txt']},
        vbnet: {name: 'VB.Net', extensions: ['vbnet', 'vb', 'bas'], aliases: ['vb', 'visualbasic']},
        vbscript: {name: 'VBScript', extensions: ['vbs']},
        verilog: {name: 'Verilog', extensions: ['v', 'veo']},
        xml: {name: 'HTML, XML', extensions: ['xml', 'html', 'xhtml', 'rss', 'atom', 'xsl', 'plist']},
        yaml: {name: 'YAML', extensions: ['yaml'], aliases: ['yml']}
    },
    PostsViewJumpTypes: {
        BOTTOM: 1,
        POST: 2,
        SIDEBAR_OPEN: 3
    },
    NotificationPrefs: {
        MENTION: 'mention'
    },
    Integrations: {
        COMMAND: 'commands',
        INCOMING_WEBHOOK: 'incoming_webhooks',
        OUTGOING_WEBHOOK: 'outgoing_webhooks',
        OAUTH_APP: 'oauth2-apps'
    },
    FeatureTogglePrefix: 'feature_enabled_',
    PRE_RELEASE_FEATURES: {
        MARKDOWN_PREVIEW: {
            label: 'markdown_preview', // github issue: https://github.com/mattermost/platform/pull/1389
            description: 'Show markdown preview option in message input box'
        },
        EMBED_PREVIEW: {
            label: 'embed_preview',
            description: 'Show preview snippet of links below message'
        },
        WEBRTC_PREVIEW: {
            label: 'webrtc_preview',
            description: 'Enable WebRTC one on one calls'
        },
        EMOJI_PICKER_PREVIEW: {
            label: 'emojipicker',
            description: 'Enable emoji picker'
        }
    },
    OVERLAY_TIME_DELAY_SMALL: 100,
    OVERLAY_TIME_DELAY: 400,
    WEBRTC_TIME_DELAY: 750,
    WEBRTC_CLEAR_ERROR_DELAY: 15000,
    DEFAULT_MAX_USERS_PER_TEAM: 50,
    MIN_TEAMNAME_LENGTH: 2,
    DEFAULT_MAX_CHANNELS_PER_TEAM: 2000,
    DEFAULT_MAX_NOTIFICATIONS_PER_CHANNEL: 1000,
    MAX_TEAMNAME_LENGTH: 15,
    MAX_TEAMDESCRIPTION_LENGTH: 50,
    MIN_CHANNELNAME_LENGTH: 2,
    MAX_CHANNELNAME_LENGTH: 22,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 22,
    MAX_NICKNAME_LENGTH: 22,
    MIN_PASSWORD_LENGTH: 5,
    MAX_PASSWORD_LENGTH: 64,
    MAX_POSITION_LENGTH: 35,
    MIN_TRIGGER_LENGTH: 1,
    MAX_TRIGGER_LENGTH: 128,
    MAX_SITENAME_LENGTH: 30,
    TIME_SINCE_UPDATE_INTERVAL: 30000,
    MIN_HASHTAG_LINK_LENGTH: 3,
    CHANNEL_SCROLL_ADJUSTMENT: 100,
    EMOJI_PATH: '/static/emoji',
    RECENT_EMOJI_KEY: 'recentEmojis',
    DEFAULT_WEBHOOK_LOGO: logoWebhook,
    MHPNS: 'https://push.mattermost.com',
    MTPNS: 'http://push-test.mattermost.com',
    BOT_NAME: 'BOT',
    MAX_PREV_MSGS: 100,
    POST_COLLAPSE_TIMEOUT: 1000 * 60 * 5, // five minutes
    PERMISSIONS_ALL: 'all',
    PERMISSIONS_CHANNEL_ADMIN: 'channel_admin',
    PERMISSIONS_TEAM_ADMIN: 'team_admin',
    PERMISSIONS_SYSTEM_ADMIN: 'system_admin',
    PERMISSIONS_DELETE_POST_ALL: 'all',
    PERMISSIONS_DELETE_POST_TEAM_ADMIN: 'team_admin',
    PERMISSIONS_DELETE_POST_SYSTEM_ADMIN: 'system_admin',
    ALLOW_EDIT_POST_ALWAYS: 'always',
    ALLOW_EDIT_POST_NEVER: 'never',
    ALLOW_EDIT_POST_TIME_LIMIT: 'time_limit',
    DEFAULT_POST_EDIT_TIME_LIMIT: 300,
    MENTION_CHANNELS: 'mention.channels',
    MENTION_MORE_CHANNELS: 'mention.morechannels',
    MENTION_MEMBERS: 'mention.members',
    MENTION_NONMEMBERS: 'mention.nonmembers',
    MENTION_SPECIAL: 'mention.special',
    DEFAULT_NOTIFICATION_DURATION: 5000,
    STATUS_INTERVAL: 60000,
    AUTOCOMPLETE_TIMEOUT: 100,
    ANIMATION_TIMEOUT: 1000,
    SEARCH_TIMEOUT_MILLISECONDS: 100,
    DIAGNOSTICS_SEGMENT_KEY: 'fwb7VPbFeQ7SKp3wHm1RzFUuXZudqVok',
    TEST_ID_COUNT: 0,
    CENTER: 'center',
    RHS: 'rhs',
    RHS_ROOT: 'rhsroot',
    TEAMMATE_NAME_DISPLAY: {
        SHOW_USERNAME: 'username',
        SHOW_NICKNAME_FULLNAME: 'nickname_full_name',
        SHOW_FULLNAME: 'full_name'
    }
};

export default Constants;
