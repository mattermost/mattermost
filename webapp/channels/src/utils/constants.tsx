// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import keyMirror from 'key-mirror';

import Permissions from 'mattermost-redux/constants/permissions';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import audioIcon from 'images/icons/audio.svg';
import codeIcon from 'images/icons/code.svg';
import excelIcon from 'images/icons/excel.svg';
import genericIcon from 'images/icons/generic.svg';
import patchIcon from 'images/icons/patch.svg';
import pdfIcon from 'images/icons/pdf.svg';
import pptIcon from 'images/icons/ppt.svg';
import videoIcon from 'images/icons/video.svg';
import wordIcon from 'images/icons/word.svg';
import logoImage from 'images/logo_compact.png';
import githubIcon from 'images/themes/code_themes/github.png';
import monokaiIcon from 'images/themes/code_themes/monokai.png';
import solarizedDarkIcon from 'images/themes/code_themes/solarized-dark.png';
import solarizedLightIcon from 'images/themes/code_themes/solarized-light.png';
import logoWebhook from 'images/webhook_icon.jpg';

import {t} from 'utils/i18n';

import {CustomStatusDuration} from '@mattermost/types/users';

import githubCSS from 'highlight.js/styles/github.css';
import monokaiCSS from 'highlight.js/styles/monokai.css';
import solarizedDarkCSS from 'highlight.js/styles/base16/solarized-dark.css';
import solarizedLightCSS from 'highlight.js/styles/base16/solarized-light.css';

export const SettingsTypes = {
    TYPE_TEXT: 'text',
    TYPE_LONG_TEXT: 'longtext',
    TYPE_NUMBER: 'number',
    TYPE_COLOR: 'color',
    TYPE_BOOL: 'bool',
    TYPE_PERMISSION: 'permission',
    TYPE_RADIO: 'radio',
    TYPE_BANNER: 'banner',
    TYPE_DROPDOWN: 'dropdown',
    TYPE_GENERATED: 'generated',
    TYPE_USERNAME: 'username',
    TYPE_BUTTON: 'button',
    TYPE_LANGUAGE: 'language',
    TYPE_JOBSTABLE: 'jobstable',
    TYPE_FILE_UPLOAD: 'fileupload',
    TYPE_CUSTOM: 'custom',
};

export const InviteTypes = {
    INVITE_MEMBER: 'member',
    INVITE_GUEST: 'guest',
};

export const PreviousViewedTypes = {
    CHANNELS: 'channels',
    THREADS: 'threads',
    INSIGHTS: 'insights',
};

export const Preferences = {
    CATEGORY_CHANNEL_OPEN_TIME: 'channel_open_time',
    CATEGORY_DIRECT_CHANNEL_SHOW: 'direct_channel_show',
    CATEGORY_GROUP_CHANNEL_SHOW: 'group_channel_show',
    CATEGORY_DISPLAY_SETTINGS: 'display_settings',
    CATEGORY_SIDEBAR_SETTINGS: 'sidebar_settings',
    CATEGORY_ADVANCED_SETTINGS: 'advanced_settings',
    TUTORIAL_STEP: 'tutorial_step',
    TUTORIAL_STEP_AUTO_TOUR_STATUS: 'tutorial_step_auto_tour_status',
    CRT_TUTORIAL_TRIGGERED: 'crt_tutorial_triggered',
    CRT_TUTORIAL_AUTO_TOUR_STATUS: 'crt_tutorial_auto_tour_status',
    CRT_TUTORIAL_STEP: 'crt_tutorial_step',
    EXPLORE_OTHER_TOOLS_TUTORIAL_STEP: 'explore_other_tools_step',
    CRT_THREAD_PANE_STEP: 'crt_thread_pane_step',
    CHANNEL_DISPLAY_MODE: 'channel_display_mode',
    CHANNEL_DISPLAY_MODE_CENTERED: 'centered',
    CHANNEL_DISPLAY_MODE_FULL_SCREEN: 'full',
    CHANNEL_DISPLAY_MODE_DEFAULT: 'full',
    MESSAGE_DISPLAY: 'message_display',
    MESSAGE_DISPLAY_CLEAN: 'clean',
    MESSAGE_DISPLAY_COMPACT: 'compact',
    MESSAGE_DISPLAY_DEFAULT: 'clean',
    COLORIZE_USERNAMES: 'colorize_usernames',
    COLORIZE_USERNAMES_DEFAULT: 'true',
    COLLAPSED_REPLY_THREADS: 'collapsed_reply_threads',
    COLLAPSED_REPLY_THREADS_OFF: 'off',
    COLLAPSED_REPLY_THREADS_ON: 'on',
    CLICK_TO_REPLY: 'click_to_reply',
    CLICK_TO_REPLY_DEFAULT: 'true',
    COLLAPSED_REPLY_THREADS_FALLBACK_DEFAULT: 'off',
    LINK_PREVIEW_DISPLAY: 'link_previews',
    LINK_PREVIEW_DISPLAY_DEFAULT: 'true',
    COLLAPSE_DISPLAY: 'collapse_previews',
    COLLAPSE_DISPLAY_DEFAULT: 'false',
    AVAILABILITY_STATUS_ON_POSTS: 'availability_status_on_posts',
    AVAILABILITY_STATUS_ON_POSTS_DEFAULT: 'true',
    USE_MILITARY_TIME: 'use_military_time',
    USE_MILITARY_TIME_DEFAULT: 'false',
    UNREAD_SCROLL_POSITION: 'unread_scroll_position',
    UNREAD_SCROLL_POSITION_START_FROM_LEFT: 'start_from_left_off',
    UNREAD_SCROLL_POSITION_START_FROM_NEWEST: 'start_from_newest',
    CATEGORY_THEME: 'theme',
    CATEGORY_FLAGGED_POST: 'flagged_post',
    CATEGORY_NOTIFICATIONS: 'notifications',
    EMAIL_INTERVAL: 'email_interval',
    INTERVAL_IMMEDIATE: 30, // "immediate" is a 30 second interval
    INTERVAL_FIFTEEN_MINUTES: 15 * 60,
    INTERVAL_HOUR: 60 * 60,
    INTERVAL_NEVER: 0,
    NAME_NAME_FORMAT: 'name_format',
    CATEGORY_SYSTEM_NOTICE: 'system_notice',
    RECOMMENDED_NEXT_STEPS: 'recommended_next_steps',
    TEAMS_ORDER: 'teams_order',
    CLOUD_UPGRADE_BANNER: 'cloud_upgrade_banner',
    CLOUD_TRIAL_BANNER: 'cloud_trial_banner',
    START_TRIAL_MODAL: 'start_trial_modal',
    ADMIN_CLOUD_UPGRADE_PANEL: 'admin_cloud_upgrade_panel',
    CATEGORY_EMOJI: 'emoji',
    EMOJI_SKINTONE: 'emoji_skintone',
    ONE_CLICK_REACTIONS_ENABLED: 'one_click_reactions_enabled',
    ONE_CLICK_REACTIONS_ENABLED_DEFAULT: 'true',
    CLOUD_TRIAL_END_BANNER: 'cloud_trial_end_banner',
    CLOUD_USER_EPHEMERAL_INFO: 'cloud_user_ephemeral_info',
    CATEGORY_CLOUD_LIMITS: 'cloud_limits',
    THREE_DAYS_LEFT_TRIAL_MODAL: 'three_days_left_trial_modal',

    // For one off things that have a special, attention-grabbing UI until you interact with them
    TOUCHED: 'touched',

    // Category for actions/interactions that will happen just once
    UNIQUE: 'unique',

    // A/B test preference value
    AB_TEST_PREFERENCE_VALUE: 'ab_test_preference_value',

    RECENT_EMOJIS: 'recent_emojis',
    ONBOARDING: 'onboarding',
    ADVANCED_TEXT_EDITOR: 'advanced_text_editor',

    FORWARD_POST_VIEWED: 'forward_post_viewed',
    HIDE_POST_FILE_UPGRADE_WARNING: 'hide_post_file_upgrade_warning',
    SHOWN_LIMITS_REACHED_ON_LOGIN: 'shown_limits_reached_on_login',
    USE_CASE: 'use_case',
    DELINQUENCY_MODAL_CONFIRMED: 'delinquency_modal_confirmed',
    CONFIGURATION_BANNERS: 'configuration_banners',
    NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE: 'admin_revoke_downgraded_instance',
    OVERAGE_USERS_BANNER: 'overage_users_banner',
    TO_CLOUD_YEARLY_PLAN_NUDGE: 'to_cloud_yearly_plan_nudge',
    TO_PAID_PLAN_NUDGE: 'to_paid_plan_nudge',
};

// For one off things that have a special, attention-grabbing UI until you interact with them
export const Touched = {
    INVITE_MEMBERS: 'invite_members',
    ADD_CHANNELS_CTA: 'add_channels_cta',
};

// Category for actions/interactions that will happen just once
export const Unique = {
    HAS_CLOUD_PURCHASE: 'has_cloud_purchase',
    REQUEST_TRIAL_AFTER_SERVER_UPGRADE: 'request_trial_after_upgrade',
    CLICKED_UPGRADE_AND_TRIAL_BTN: 'clicked_upgradeandtrial_btn',
};

export const TrialPeriodDays = {
    TRIAL_30_DAYS: 30,
    TRIAL_14_DAYS: 14,
    TRIAL_WARNING_THRESHOLD: 7,
    TRIAL_2_DAYS: 2,
    TRIAL_1_DAY: 1,
    TRIAL_0_DAYS: 0,
};

export const suitePluginIds = {
    playbooks: 'playbooks',

    /**
     * @warning This only applies to the Boards product and will not work with the Boards plugin. Both cases need to
     * be supported until we enable the Boards product permanently.
     */
    boards: 'boards',

    /**
     * @deprecated This only applies to the Boards plugin and will not work with the Boards product. Both cases need
     * to be supported until we enable the Boards product permanently.
     */
    focalboard: 'focalboard',

    apps: 'com.mattermost.apps',
    calls: 'com.mattermost.calls',
    nps: 'com.mattermost.nps',
    channelExport: 'com.mattermost.plugin-channel-export',
};

export const ActionTypes = keyMirror({
    SET_PRODUCT_SWITCHER_OPEN: null,
    RECEIVED_FOCUSED_POST: null,
    SELECT_POST: null,
    HIGHLIGHT_REPLY: null,
    CLEAR_HIGHLIGHT_REPLY: null,
    SELECT_POST_CARD: null,
    INCREASE_POST_VISIBILITY: null,
    LOADING_POSTS: null,

    UPDATE_RHS_STATE: null,
    UPDATE_RHS_SEARCH_TERMS: null,
    UPDATE_RHS_SEARCH_TYPE: null,
    UPDATE_RHS_SEARCH_RESULTS_TERMS: null,

    RHS_GO_BACK: null,

    SET_RHS_EXPANDED: null,
    TOGGLE_RHS_EXPANDED: null,

    UPDATE_MOBILE_VIEW: null,

    SET_NAVIGATION_BLOCKED: null,
    DEFER_NAVIGATION: null,
    CANCEL_NAVIGATION: null,
    CONFIRM_NAVIGATION: null,

    TOGGLE_IMPORT_THEME_MODAL: null,
    TOGGLE_DELETE_POST_MODAL: null,
    TOGGLE_EDITING_POST: null,

    EMITTED_SHORTCUT_REACT_TO_LAST_POST: null,

    BROWSER_CHANGE_FOCUS: null,
    BROWSER_WINDOW_RESIZED: null,

    RECEIVED_PLUGIN_COMPONENT: null,
    REMOVED_PLUGIN_COMPONENT: null,
    RECEIVED_PLUGIN_POST_COMPONENT: null,
    RECEIVED_PLUGIN_POST_CARD_COMPONENT: null,
    REMOVED_PLUGIN_POST_COMPONENT: null,
    REMOVED_PLUGIN_POST_CARD_COMPONENT: null,
    RECEIVED_WEBAPP_PLUGINS: null,
    RECEIVED_WEBAPP_PLUGIN: null,
    REMOVED_WEBAPP_PLUGIN: null,
    RECEIVED_ADMIN_CONSOLE_REDUCER: null,
    REMOVED_ADMIN_CONSOLE_REDUCER: null,
    RECEIVED_ADMIN_CONSOLE_CUSTOM_COMPONENT: null,
    RECEIVED_PLUGIN_STATS_HANDLER: null,

    MODAL_OPEN: null,
    MODAL_CLOSE: null,

    SELECT_CHANNEL_WITH_MEMBER: null,
    SET_LAST_UNREAD_CHANNEL: null,
    UPDATE_CHANNEL_LAST_VIEWED_AT: null,

    INCREMENT_EMOJI_PICKER_PAGE: null,
    SET_RECENT_SKIN: null,

    STATUS_DROPDOWN_TOGGLE: null,
    ADD_CHANNEL_DROPDOWN_TOGGLE: null,
    ADD_CHANNEL_CTA_DROPDOWN_TOGGLE: null,

    SHOW_ONBOARDING_TASK_COMPLETION: null,
    SHOW_ONBOARDING_COMPLETE_PROFILE_TOUR: null,
    SHOW_ONBOARDING_VISIT_CONSOLE_TOUR: null,

    TOGGLE_LHS: null,
    OPEN_LHS: null,
    CLOSE_LHS: null,
    SELECT_STATIC_PAGE: null,

    SET_SHOW_PREVIEW_ON_CREATE_COMMENT: null,
    SET_SHOW_PREVIEW_ON_CREATE_POST: null,
    SET_SHOW_PREVIEW_ON_EDIT_CHANNEL_HEADER_MODAL: null,

    TOGGLE_RHS_MENU: null,
    OPEN_RHS_MENU: null,
    CLOSE_RHS_MENU: null,

    DISMISS_NOTICE: null,
    SHOW_NOTICE: null,

    SELECT_ATTACHMENT_MENU_ACTION: null,

    RECEIVED_TRANSLATIONS: null,

    INCREMENT_WS_ERROR_COUNT: null,
    RESET_WS_ERROR_COUNT: null,
    RECEIVED_POSTS_FOR_CHANNEL_AT_TIME: null,
    CHANNEL_POSTS_STATUS: null,
    CHANNEL_SYNC_STATUS: null,
    ALL_CHANNEL_SYNC_STATUS: null,

    UPDATE_ACTIVE_SECTION: null,

    RECEIVED_MARKETPLACE_PLUGINS: null,
    RECEIVED_MARKETPLACE_APPS: null,
    FILTER_MARKETPLACE_LISTING: null,
    INSTALLING_MARKETPLACE_ITEM: null,
    INSTALLING_MARKETPLACE_ITEM_SUCCEEDED: null,
    INSTALLING_MARKETPLACE_ITEM_FAILED: null,

    POST_UNREAD_SUCCESS: null,

    SET_UNREAD_FILTER_ENABLED: null,
    UPDATE_TOAST_STATUS: null,
    UPDATE_THREAD_TOAST_STATUS: null,

    SIDEBAR_DRAGGING_SET_STATE: null,
    SIDEBAR_DRAGGING_STOP: null,
    ADD_NEW_CATEGORY_ID: null,
    MULTISELECT_CHANNEL: null,
    MULTISELECT_CHANNEL_ADD: null,
    MULTISELECT_CHANNEL_TO: null,
    MULTISELECT_CHANNEL_CLEAR: null,

    TRACK_ANNOUNCEMENT_BAR: null,
    DISMISS_ANNOUNCEMENT_BAR: null,

    PREFETCH_POSTS_FOR_CHANNEL: null,

    SET_FILES_FILTER_BY_EXT: null,

    SUPPRESS_RHS: null,
    UNSUPPRESS_RHS: null,

    FIRST_CHANNEL_NAME: null,

    RECEIVED_PLUGIN_INSIGHT: null,
    SET_EDIT_CHANNEL_MEMBERS: null,
    NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK: null,

    SET_DRAFT_SOURCE: null,
});

export const PostRequestTypes = keyMirror({
    BEFORE_ID: null,
    AFTER_ID: null,
});

export const WarnMetricTypes = {
    SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100: 'warn_metric_number_of_active_users_100',
    SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200: 'warn_metric_number_of_active_users_200',
    SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300: 'warn_metric_number_of_active_users_300',
    SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500: 'warn_metric_number_of_active_users_500',
    SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5: 'warn_metric_number_of_teams_5',
    SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_5: 'warn_metric_number_of_channels_50',
    SYSTEM_WARN_METRIC_MFA: 'warn_metric_mfa',
    SYSTEM_WARN_METRIC_EMAIL_DOMAIN: 'warn_metric_email_domain',
    SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M: 'warn_metric_number_of_posts_2M',
};

export const ModalIdentifiers = {
    ABOUT: 'about',
    TEAM_SETTINGS: 'team_settings',
    CHANNEL_INFO: 'channel_info',
    DELETE_CHANNEL: 'delete_channel',
    UNARCHIVE_CHANNEL: 'unarchive_channel',
    CHANNEL_NOTIFICATIONS: 'channel_notifications',
    CHANNEL_INVITE: 'channel_invite',
    CHANNEL_MEMBERS: 'channel_members',
    TEAM_MEMBERS: 'team_members',
    ADD_USER_TO_CHANNEL: 'add_user_to_channel',
    ADD_USER_TO_ROLE: 'add_user_to_role',
    ADD_USER_TO_TEAM: 'add_user_to_team',
    CREATE_DM_CHANNEL: 'create_dm_channel',
    EDIT_CHANNEL_HEADER: 'edit_channel_header',
    EDIT_CHANNEL_PURPOSE: 'edit_channel_purpose',
    DELETE_POST: 'delete_post',
    CONVERT_CHANNEL: 'convert_channel',
    RESET_STATUS: 'reset_status',
    LEAVE_TEAM: 'leave_team',
    RENAME_CHANNEL: 'rename_channel',
    USER_SETTINGS: 'user_settings',
    QUICK_SWITCH: 'quick_switch',
    REMOVED_FROM_CHANNEL: 'removed_from_channel',
    EMAIL_INVITE: 'email_invite',
    INTERACTIVE_DIALOG: 'interactive_dialog',
    APPS_MODAL: 'apps_modal',
    ADD_TEAMS_TO_SCHEME: 'add_teams_to_scheme',
    INVITATION: 'invitation',
    ADD_GROUPS_TO_TEAM: 'add_groups_to_team',
    ADD_GROUPS_TO_CHANNEL: 'add_groups_to_channel',
    MANAGE_TEAM_GROUPS: 'manage_team_groups',
    MANAGE_CHANNEL_GROUPS: 'manage_channel_groups',
    GROUP_MEMBERS: 'group_members',
    MOBILE_SUBMENU: 'mobile_submenu',
    PLUGIN_MARKETPLACE: 'plugin_marketplace',
    EDIT_CATEGORY: 'edit_category',
    DELETE_CATEGORY: 'delete_category',
    SIDEBAR_WHATS_NEW_MODAL: 'sidebar_whats_new_modal',
    WARN_METRIC_ACK: 'warn_metric_acknowledgement',
    UPGRADE_CLOUD_ACCOUNT: 'upgrade_cloud_account',
    START_TRIAL_MODAL: 'start_trial_modal',
    TRIAL_BENEFITS_MODAL: 'trial_benefits_modal',
    PRICING_MODAL: 'pricing_modal',
    LEARN_MORE_TRIAL_MODAL: 'learn_more_trial_modal',
    ENTERPRISE_EDITION_LICENSE: 'enterprise_edition_license',
    CONFIRM_NOTIFY_ADMIN: 'confirm_notify_admin',
    REMOVE_NEXT_STEPS_MODAL: 'remove_next_steps_modal',
    MORE_CHANNELS: 'more_channels',
    NEW_CHANNEL_MODAL: 'new_channel_modal',
    CLOUD_PURCHASE: 'cloud_purchase',
    SELF_HOSTED_PURCHASE: 'self_hosted_purchase',
    CLOUD_DOWNGRADE_CHOOSE_TEAM: 'cloud_downgrade_choose_team',
    SUCCESS_MODAL: 'success_modal',
    ERROR_MODAL: 'error_modal',
    DND_CUSTOM_TIME_PICKER: 'dnd_custom_time_picker',
    POST_REMINDER_CUSTOM_TIME_PICKER: 'post_reminder_custom_time_picker',
    CUSTOM_STATUS: 'custom_status',
    COMMERCIAL_SUPPORT: 'commercial_support',
    NO_INTERNET_CONNECTION: 'no_internet_connection',
    JOIN_CHANNEL_PROMPT: 'join_channel_prompt',
    COLLAPSED_REPLY_THREADS_MODAL: 'collapsed_reply_threads_modal',
    NOTIFY_CONFIRM_MODAL: 'notify_confirm_modal',
    CONFIRM_LICENSE_REMOVAL: 'confirm_license_removal',
    CONFIRM: 'confirm',
    USER_GROUPS: 'user_groups',
    USER_GROUPS_CREATE: 'user_groups_create',
    VIEW_USER_GROUP: 'view_user_group',
    ADD_USERS_TO_GROUP: 'add_users_to_group',
    EDIT_GROUP_MODAL: 'edit_group_modal',
    POST_DELETED_MODAL: 'post_deleted_modal',
    FILE_PREVIEW_MODAL: 'file_preview_modal',
    IMPORT_THEME_MODAL: 'import_theme_modal',
    LEAVE_PRIVATE_CHANNEL_MODAL: 'leave_private_channel_modal',
    GET_PUBLIC_LINK_MODAL: 'get_public_link_modal',
    KEYBOARD_SHORTCUTS_MODAL: 'keyboar_shortcuts_modal',
    USERS_TO_BE_REMOVED: 'users_to_be_removed',
    DELETE_DRAFT: 'delete_draft_modal',
    SEND_DRAFT: 'send_draft_modal',
    UPLOAD_LICENSE: 'upload_license',
    INSIGHTS: 'insights',
    CLOUD_LIMITS: 'cloud_limits',
    THREE_DAYS_LEFT_TRIAL_MODAL: 'three_days_left_trial_modal',
    REQUEST_BUSINESS_EMAIL_MODAL: 'request_business_email_modal',
    FEATURE_RESTRICTED_MODAL: 'feature_restricted_modal',
    FORWARD_POST_MODAL: 'forward_post_modal',
    CLOUD_SUBSCRIBE_WITH_LOADING_MODAL: 'cloud_subscribe_with_loading_modal',
    JOIN_PUBLIC_CHANNEL_MODAL: 'join_public_channel_modal',
    CLOUD_INVOICE_PREVIEW: 'cloud_invoice_preview',
    BILLING_HISTORY: 'billing_history',
    SUM_OF_MEMBERS_MODAL: 'sum_of_members_modal',
    RESTORE_POST_MODAL: 'restore_post',
    INFO_TOAST: 'info_toast',
    MARK_ALL_THREADS_AS_READ: 'mark_all_threads_as_read_modal',
    DELINQUENCY_MODAL_DOWNGRADE: 'delinquency_modal_downgrade',
    CLOUD_LIMITS_DOWNGRADE: 'cloud_limits_downgrade',
    PERSIST_NOTIFICATION_CONFIRM_MODAL: 'persist_notification_confirm_modal',
    AIR_GAPPED_SELF_HOSTED_PURCHASE: 'air_gapped_self_hosted_purchase',
    WORK_TEMPLATE: 'work_template',
    DOWNGRADE_MODAL: 'downgrade_modal',
    PURCHASE_IN_PROGRESS: 'purchase_in_progress',
    DELETE_WORKSPACE: 'delete_workspace',
    FEEDBACK: 'feedback',
    DELETE_WORKSPACE_PROGRESS: 'delete_workspace_progress',
    DELETE_WORKSPACE_RESULT: 'delete_workspace_result',
    SCREENING_IN_PROGRESS: 'screening_in_progress',
    CONFIRM_SWITCH_TO_YEARLY: 'confirm_switch_to_yearly',
    EXPANSION_IN_PROGRESS: 'expansion_in_progress',
    SELF_HOSTED_EXPANSION: 'self_hosted_expansion',
    START_TRIAL_FORM_MODAL: 'start_trial_form_modal',
    START_TRIAL_FORM_MODAL_RESULT: 'start_trial_form_modal_result',
};

export const UserStatuses = {
    OUT_OF_OFFICE: 'ooo',
    OFFLINE: 'offline',
    AWAY: 'away',
    ONLINE: 'online',
    DND: 'dnd',
} as const;

export const EventTypes = Object.assign(
    {
        KEY_DOWN: 'keydown',
        KEY_UP: 'keyup',
        CLICK: 'click',
        FOCUS: 'focus',
        BLUR: 'blur',
        SHORTCUT: 'shortcut',
        MOUSE_DOWN: 'mousedown',
        MOUSE_UP: 'mouseup',
    },
    keyMirror({
        POST_LIST_SCROLL_TO_BOTTOM: null,
    }),
);

export const CloudProducts = {

    // STARTER sku is used by both free cloud starter
    // and paid cloud starter (legacy cloud starter).
    // Where differentiation is needed, check whether any limits are applied.
    // If none are applied, it must be legacy cloud starter.
    STARTER: 'cloud-starter',
    PROFESSIONAL: 'cloud-professional',
    ENTERPRISE: 'cloud-enterprise',
    LEGACY: 'cloud-legacy',
};

export const CloudBillingTypes = {
    INTERNAL: 'internal',
    LICENSED: 'licensed',
};

export const SelfHostedProducts = {
    STARTER: 'starter',
    PROFESSIONAL: 'professional',
    ENTERPRISE: 'enterprise',
};

export const MattermostFeatures = {
    GUEST_ACCOUNTS: 'mattermost.feature.guest_accounts',
    CUSTOM_USER_GROUPS: 'mattermost.feature.custom_user_groups',
    CREATE_MULTIPLE_TEAMS: 'mattermost.feature.create_multiple_teams',
    START_CALL: 'mattermost.feature.start_call',
    PLAYBOOKS_RETRO: 'mattermost.feature.playbooks_retro',
    UNLIMITED_MESSAGES: 'mattermost.feature.unlimited_messages',
    UNLIMITED_FILE_STORAGE: 'mattermost.feature.unlimited_file_storage',
    TEAM_INSIGHTS: 'mattermost.feature.team_insights',
    ALL_PROFESSIONAL_FEATURES: 'mattermost.feature.all_professional',
    ALL_ENTERPRISE_FEATURES: 'mattermost.feature.all_enterprise',
    UPGRADE_DOWNGRADED_WORKSPACE: 'mattermost.feature.upgrade_downgraded_workspace',
    PLUGIN_FEATURE: 'mattermost.feature.plugin',
};

export enum LicenseSkus {
    E10 = 'E10',
    E20 = 'E20',
    Starter = 'starter',
    Professional = 'professional',
    Enterprise = 'enterprise',
}

export const CloudProductToSku = {
    [CloudProducts.PROFESSIONAL]: LicenseSkus.Professional,
    [CloudProducts.ENTERPRISE]: LicenseSkus.Enterprise,
};

export const A11yClassNames = {
    REGION: 'a11y__region',
    SECTION: 'a11y__section',
    ACTIVE: 'a11y--active',
    FOCUSED: 'a11y--focused',
    MODAL: 'a11y__modal',
    POPUP: 'a11y__popup',
};

export const A11yAttributeNames = {
    SORT_ORDER: 'data-a11y-sort-order',
    ORDER_REVERSE: 'data-a11y-order-reversed',
    FOCUS_CHILD: 'data-a11y-focus-child',
    LOOP_NAVIGATION: 'data-a11y-loop-navigation',
    DISABLE_NAVIGATION: 'data-a11y-disable-nav',
};

export const A11yCustomEventTypes = {
    ACTIVATE: 'a11yactivate',
    DEACTIVATE: 'a11ydeactivate',
    UPDATE: 'a11yupdate',
    FOCUS: 'a11yfocus',
};

export type A11yFocusEventDetail = {
    target: HTMLElement | null | undefined;
    keyboardOnly: boolean;
}

export function isA11yFocusEventDetail(o: unknown): o is A11yFocusEventDetail {
    return Boolean(o && typeof o === 'object' && 'keyboardOnly' in o);
}

export const AppEvents = {
    FOCUS_EDIT_TEXTBOX: 'focus_edit_textbox',
};

export const SocketEvents = {
    POSTED: 'posted',
    POST_EDITED: 'post_edited',
    POST_DELETED: 'post_deleted',
    POST_UPDATED: 'post_updated',
    POST_UNREAD: 'post_unread',
    CHANNEL_CONVERTED: 'channel_converted',
    CHANNEL_CREATED: 'channel_created',
    CHANNEL_DELETED: 'channel_deleted',
    CHANNEL_UNARCHIVED: 'channel_restored',
    CHANNEL_UPDATED: 'channel_updated',
    CHANNEL_VIEWED: 'channel_viewed',
    CHANNEL_MEMBER_UPDATED: 'channel_member_updated',
    CHANNEL_SCHEME_UPDATED: 'channel_scheme_updated',
    DIRECT_ADDED: 'direct_added',
    GROUP_ADDED: 'group_added',
    NEW_USER: 'new_user',
    ADDED_TO_TEAM: 'added_to_team',
    JOIN_TEAM: 'join_team',
    LEAVE_TEAM: 'leave_team',
    UPDATE_TEAM: 'update_team',
    DELETE_TEAM: 'delete_team',
    UPDATE_TEAM_SCHEME: 'update_team_scheme',
    USER_ADDED: 'user_added',
    USER_REMOVED: 'user_removed',
    USER_UPDATED: 'user_updated',
    USER_ROLE_UPDATED: 'user_role_updated',
    MEMBERROLE_UPDATED: 'memberrole_updated',
    ROLE_ADDED: 'role_added',
    ROLE_REMOVED: 'role_removed',
    ROLE_UPDATED: 'role_updated',
    TYPING: 'typing',
    PREFERENCE_CHANGED: 'preference_changed',
    PREFERENCES_CHANGED: 'preferences_changed',
    PREFERENCES_DELETED: 'preferences_deleted',
    EPHEMERAL_MESSAGE: 'ephemeral_message',
    STATUS_CHANGED: 'status_change',
    HELLO: 'hello',
    REACTION_ADDED: 'reaction_added',
    REACTION_REMOVED: 'reaction_removed',
    EMOJI_ADDED: 'emoji_added',
    PLUGIN_ENABLED: 'plugin_enabled',
    PLUGIN_DISABLED: 'plugin_disabled',
    LICENSE_CHANGED: 'license_changed',
    CONFIG_CHANGED: 'config_changed',
    PLUGIN_STATUSES_CHANGED: 'plugin_statuses_changed',
    OPEN_DIALOG: 'open_dialog',
    RECEIVED_GROUP: 'received_group',
    GROUP_MEMBER_ADD: 'group_member_add',
    GROUP_MEMBER_DELETED: 'group_member_deleted',
    RECEIVED_GROUP_ASSOCIATED_TO_TEAM: 'received_group_associated_to_team',
    RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM: 'received_group_not_associated_to_team',
    RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL: 'received_group_associated_to_channel',
    RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL: 'received_group_not_associated_to_channel',
    WARN_METRIC_STATUS_RECEIVED: 'warn_metric_status_received',
    WARN_METRIC_STATUS_REMOVED: 'warn_metric_status_removed',
    SIDEBAR_CATEGORY_CREATED: 'sidebar_category_created',
    SIDEBAR_CATEGORY_UPDATED: 'sidebar_category_updated',
    SIDEBAR_CATEGORY_DELETED: 'sidebar_category_deleted',
    SIDEBAR_CATEGORY_ORDER_UPDATED: 'sidebar_category_order_updated',
    USER_ACTIVATION_STATUS_CHANGED: 'user_activation_status_change',
    CLOUD_PAYMENT_STATUS_UPDATED: 'cloud_payment_status_updated',
    CLOUD_SUBSCRIPTION_CHANGED: 'cloud_subscription_changed',
    APPS_FRAMEWORK_REFRESH_BINDINGS: 'custom_com.mattermost.apps_refresh_bindings',
    APPS_FRAMEWORK_PLUGIN_ENABLED: 'custom_com.mattermost.apps_plugin_enabled',
    APPS_FRAMEWORK_PLUGIN_DISABLED: 'custom_com.mattermost.apps_plugin_disabled',
    FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED: 'first_admin_visit_marketplace_status_received',
    THREAD_UPDATED: 'thread_updated',
    THREAD_FOLLOW_CHANGED: 'thread_follow_changed',
    THREAD_READ_CHANGED: 'thread_read_changed',
    POST_ACKNOWLEDGEMENT_ADDED: 'post_acknowledgement_added',
    POST_ACKNOWLEDGEMENT_REMOVED: 'post_acknowledgement_removed',
    DRAFT_CREATED: 'draft_created',
    DRAFT_UPDATED: 'draft_updated',
    DRAFT_DELETED: 'draft_deleted',
    PERSISTENT_NOTIFICATION_TRIGGERED: 'persistent_notification_triggered',
    HOSTED_CUSTOMER_SIGNUP_PROGRESS_UPDATED: 'hosted_customer_signup_progress_updated',
};

export const TutorialSteps = {
    ADD_FIRST_CHANNEL: -1,
    POST_POPOVER: 0,
    CHANNEL_POPOVER: 1,
    ADD_CHANNEL_POPOVER: 2,
    MENU_POPOVER: 3,
    PRODUCT_SWITCHER: 4,
    SETTINGS: 5,
    START_TRIAL: 6,
    FINISHED: 999,
};

// note: add steps in same order as the keys in TutorialSteps above
export const AdminTutorialSteps = ['START_TRIAL'];

export const CrtTutorialSteps = {
    WELCOME_POPOVER: 0,
    LIST_POPOVER: 1,
    UNREAD_POPOVER: 2,
    FINISHED: 999,
};

export const ExploreOtherToolsTourSteps = {
    BOARDS_TOUR: 0,
    PLAYBOOKS_TOUR: 1,
    FINISHED: 999,
};

export const CrtTutorialTriggerSteps = {
    START: 0,
    STARTED: 1,
    FINISHED: 999,
};

export const CrtThreadPaneSteps = {
    THREADS_PANE_POPOVER: 0,
    FINISHED: 999,
};

export const TopLevelProducts = {
    BOARDS: 'Boards',
    PLAYBOOKS: 'Playbooks',
};

export enum ItemStatus {
    NONE = 'none',
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

export const RecommendedNextStepsLegacy = {
    COMPLETE_PROFILE: 'complete_profile',
    TEAM_SETUP: 'team_setup',
    INVITE_MEMBERS: 'invite_members',
    PREFERENCES_SETUP: 'preferences_setup',
    NOTIFICATION_SETUP: 'notification_setup',
    DOWNLOAD_APPS: 'download_apps',
    CREATE_FIRST_CHANNEL: 'create_first_channel',
    HIDE: 'hide',
    SKIP: 'skip',
};

export const Threads = {
    CHANGED_SELECTED_THREAD: 'changed_selected_thread',
    CHANGED_LAST_VIEWED_AT: 'changed_last_viewed_at',
    MANUALLY_UNREAD_THREAD: 'manually_unread_thread',
};

export const CloudBanners = {
    HIDE: 'hide',
    TRIAL: 'trial',
    UPGRADE_FROM_TRIAL: 'upgrade_from_trial',
    THREE_DAYS_LEFT_TRIAL_MODAL_DISMISSED: 'dismiss_3_days_left_trial_modal',
    NUDGE_TO_CLOUD_YEARLY_PLAN_SNOOZED: 'nudge_to_cloud_yearly_plan_snoozed',
    NUDGE_TO_PAID_PLAN_SNOOZED: 'nudge_to_paid_plan_snoozed',
};

export const ConfigurationBanners = {
    LICENSE_EXPIRED: 'license_expired',
};

export const AdvancedTextEditor = {
    COMMENT: 'comment',
    POST: 'post',
    EDIT: 'edit',
};

export const TELEMETRY_CATEGORIES = {
    CLOUD_PURCHASING: 'cloud_purchasing',
    CLOUD_PRICING: 'cloud_pricing',
    SELF_HOSTED_PURCHASING: 'self_hosted_purchasing',
    SELF_HOSTED_EXPANSION: 'self_hosted_expansion',
    CLOUD_ADMIN: 'cloud_admin',
    CLOUD_DELINQUENCY: 'cloud_delinquency',
    SELF_HOSTED_ADMIN: 'self_hosted_admin',
    POST_INFO_MORE: 'post_info_more_menu',
    POST_INFO: 'post_info',
    SELF_HOSTED_START_TRIAL_AUTO_MODAL: 'self_hosted_start_trial_auto_modal',
    SELF_HOSTED_START_TRIAL_MODAL: 'self_hosted_start_trial_modal',
    CLOUD_START_TRIAL_BUTTON: 'cloud_start_trial_button',
    CLOUD_THREE_DAYS_LEFT_MODAL: 'cloud_three_days_left_modal',
    SELF_HOSTED_START_TRIAL_TASK_LIST: 'self_hosted_start_trial_task_list',
    SELF_HOSTED_LICENSE_EXPIRED: 'self_hosted_license_expired',
    WORKSPACE_OPTIMIZATION_DASHBOARD: 'workspace_optimization_dashboard',
    REQUEST_BUSINESS_EMAIL: 'request_business_email',
    TRUE_UP_REVIEW: 'true_up_review',
    WORK_TEMPLATES: 'work_templates',
};

export const TELEMETRY_LABELS = {
    UNSAVE: 'unsave',
    SAVE: 'save',
    COPY_LINK: 'copy_link',
    COPY_TEXT: 'copy_text',
    DELETE: 'delete',
    EDIT: 'edit',
    FOLLOW: 'follow',
    UNFOLLOW: 'unfollow',
    PIN: 'pin',
    UNPIN: 'unpin',
    REPLY: 'reply',
    UNREAD: 'unread',
    FORWARD: 'forward',
};

export const PostTypes = {
    JOIN_LEAVE: 'system_join_leave',
    JOIN_CHANNEL: 'system_join_channel',
    LEAVE_CHANNEL: 'system_leave_channel',
    ADD_TO_CHANNEL: 'system_add_to_channel',
    REMOVE_FROM_CHANNEL: 'system_remove_from_channel',
    ADD_REMOVE: 'system_add_remove',
    JOIN_TEAM: 'system_join_team',
    LEAVE_TEAM: 'system_leave_team',
    ADD_TO_TEAM: 'system_add_to_team',
    REMOVE_FROM_TEAM: 'system_remove_from_team',
    HEADER_CHANGE: 'system_header_change',
    DISPLAYNAME_CHANGE: 'system_displayname_change',
    CONVERT_CHANNEL: 'system_convert_channel',
    PURPOSE_CHANGE: 'system_purpose_change',
    CHANNEL_DELETED: 'system_channel_deleted',
    CHANNEL_UNARCHIVED: 'system_channel_restored',
    SYSTEM_GENERIC: 'system_generic',
    FAKE_PARENT_DELETED: 'system_fake_parent_deleted',
    EPHEMERAL: 'system_ephemeral',
    EPHEMERAL_ADD_TO_CHANNEL: 'system_ephemeral_add_to_channel',
    REMOVE_LINK_PREVIEW: 'remove_link_preview',
    ME: 'me',
    REMINDER: 'reminder',
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
    BOT_POST_PER_DAY: null,
    USERS_WITH_POSTS_PER_DAY: null,
    RECENTLY_ACTIVE_USERS: null,
    NEWLY_CREATED_USERS: null,
    TOTAL_WEBSOCKET_CONNECTIONS: null,
    TOTAL_MASTER_DB_CONNECTIONS: null,
    TOTAL_READ_DB_CONNECTIONS: null,
    DAILY_ACTIVE_USERS: null,
    MONTHLY_ACTIVE_USERS: null,
});

export const SearchUserTeamFilter = {
    ALL_USERS: '',
    NO_TEAM: 'no_team',
};

// UserSearchOptions are the possible option keys for a user search request
export const UserSearchOptions = {
    ALLOW_INACTIVE: 'allow_inactive',
    TEAM_ID: 'team_id',
    NOT_IN_TEAM_ID: 'not_in_team_id',
    WITHOUT_TEAM: 'without_team',
    IN_CHANNEL_ID: 'in_channel_id',
    NOT_IN_CHANNEL_ID: 'not_in_channel_id',
    GROUP_CONSTRAINED: 'group_constrained',
    ROLE: 'role',
    LIMIT: 'limit',
};

// UserListOptions are the possible option keys for get users page request
export const UserListOptions = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    IN_TEAM: 'in_team',
    NOT_IN_TEAM: 'not_in_team',
    WITHOUT_TEAM: 'without_team',
    IN_CHANNEL: 'in_channel',
    NOT_IN_CHANNEL: 'not_in_channel',
    GROUP_CONSTRAINED: 'group_constrained',
    SORT: 'sort',
    ROLE: 'role',
};

// UserFilters are the values for UI get/search user filters
export const UserFilters = {
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    SYSTEM_ADMIN: 'system_admin',
    SYSTEM_GUEST: 'system_guest',
};

export const SearchTypes = keyMirror({
    SET_MODAL_SEARCH: null,
    SET_POPOVER_SEARCH: null,
    SET_MODAL_FILTERS: null,
    SET_SYSTEM_USERS_SEARCH: null,
    SET_USER_GRID_SEARCH: null,
    SET_USER_GRID_FILTERS: null,
    SET_TEAM_LIST_SEARCH: null,
    SET_CHANNEL_LIST_SEARCH: null,
    SET_CHANNEL_LIST_FILTERS: null,
    SET_CHANNEL_MEMBERS_RHS_SEARCH: null,
});

export const StorageTypes = keyMirror({
    SET_ITEM: null,
    REMOVE_ITEM: null,
    SET_GLOBAL_ITEM: null,
    REMOVE_GLOBAL_ITEM: null,
    ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX: null,
    STORAGE_REHYDRATE: null,
});

export const StoragePrefixes = {
    EMBED_VISIBLE: 'isVisible_',
    COMMENT_DRAFT: 'comment_draft_',
    EDIT_DRAFT: 'edit_draft_',
    DRAFT: 'draft_',
    LOGOUT: '__logout__',
    LOGIN: '__login__',
    ANNOUNCEMENT: '__announcement__',
    LANDING_PAGE_SEEN: '__landingPageSeen__',
    LANDING_PREFERENCE: '__landing-preference__',
    CHANNEL_CATEGORY_COLLAPSED: 'channelCategoryCollapsed_',
    INLINE_IMAGE_VISIBLE: 'isInlineImageVisible_',
    DELINQUENCY: 'delinquency_',
    HIDE_JOINED_CHANNELS: 'hideJoinedChannels',
};

export const LandingPreferenceTypes = {
    MATTERMOSTAPP: 'mattermostapp',
    BROWSER: 'browser',
};

export const ErrorPageTypes = {
    LOCAL_STORAGE: 'local_storage',
    OAUTH_ACCESS_DENIED: 'oauth_access_denied',
    OAUTH_MISSING_CODE: 'oauth_missing_code',
    OAUTH_INVALID_PARAM: 'oauth_invalid_param',
    OAUTH_INVALID_REDIRECT_URL: 'oauth_invalid_redirect_url',
    PAGE_NOT_FOUND: 'page_not_found',
    PERMALINK_NOT_FOUND: 'permalink_not_found',
    TEAM_NOT_FOUND: 'team_not_found',
    CHANNEL_NOT_FOUND: 'channel_not_found',
    CLOUD_ARCHIVED: 'cloud_archived',
};

export const JobTypes = {
    DATA_RETENTION: 'data_retention',
    ELASTICSEARCH_POST_INDEXING: 'elasticsearch_post_indexing',
    BLEVE_POST_INDEXING: 'bleve_post_indexing',
    LDAP_SYNC: 'ldap_sync',
    MESSAGE_EXPORT: 'message_export',
};

export const JobStatuses = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    SUCCESS: 'success',
    ERROR: 'error',
    CANCEL_REQUESTED: 'cancel_requested',
    CANCELED: 'canceled',
    WARNING: 'warning',
};

export const AnnouncementBarTypes = {
    ANNOUNCEMENT: 'announcement',
    CRITICAL: 'critical',
    DEVELOPER: 'developer',
    SUCCESS: 'success',
    ADVISOR: 'advisor',
    ADVISOR_ACK: 'advisor-ack',
    GENERAL: 'general',
};

export const AnnouncementBarMessages = {
    EMAIL_VERIFICATION_REQUIRED: t('announcement_bar.error.email_verification_required'),
    EMAIL_VERIFIED: t('announcement_bar.notification.email_verified'),
    LICENSE_EXPIRED: t('announcement_bar.error.license_expired'),
    LICENSE_EXPIRING: t('announcement_bar.error.license_expiring'),
    LICENSE_PAST_GRACE: t('announcement_bar.error.past_grace'),
    PREVIEW_MODE: t('announcement_bar.error.preview_mode'),
    WEBSOCKET_PORT_ERROR: t('channel_loader.socketError'),
    WARN_METRIC_STATUS_NUMBER_OF_USERS: t('announcement_bar.warn_metric_status.number_of_users.text'),
    WARN_METRIC_STATUS_NUMBER_OF_USERS_ACK: t('announcement_bar.warn_metric_status.number_of_users_ack.text'),
    WARN_METRIC_STATUS_NUMBER_OF_POSTS: t('announcement_bar.warn_metric_status.number_of_posts.text'),
    WARN_METRIC_STATUS_NUMBER_OF_POSTS_ACK: t('announcement_bar.warn_metric_status.number_of_posts_ack.text'),
    TRIAL_LICENSE_EXPIRING: t('announcement_bar.error.trial_license_expiring'),
};

export const VerifyEmailErrors = {
    FAILED_EMAIL_VERIFICATION: 'failed_email_verification',
    FAILED_USER_STATE_GET: 'failed_get_user_state',
};

export const FileTypes = {
    TEXT: 'text',
    IMAGE: 'image',
    AUDIO: 'audio',
    VIDEO: 'video',
    SPREADSHEET: 'spreadsheet',
    CODE: 'code',
    WORD: 'word',
    PRESENTATION: 'presentation',
    PDF: 'pdf',
    PATCH: 'patch',
    SVG: 'svg',
    OTHER: 'other',
    LICENSE_EXTENSION: '.mattermost-license',
};

export const NotificationLevels = {
    DEFAULT: 'default',
    ALL: 'all',
    MENTION: 'mention',
    NONE: 'none',
} as const;

export const IgnoreChannelMentions = {
    ON: 'on',
    OFF: 'off',
    DEFAULT: 'default',
} as const;

export const ChannelAutoFollowThreads = {
    ON: 'on',
    OFF: 'off',
} as const;

export const NotificationSections = {
    IGNORE_CHANNEL_MENTIONS: 'ignoreChannelMentions',
    CHANNEL_AUTO_FOLLOW_THREADS: 'channelAutoFollowThreads',
    MARK_UNREAD: 'markUnread',
    DESKTOP: 'desktop',
    PUSH: 'push',
    NONE: '',
};

export const AdvancedSections = {
    CONTROL_SEND: 'advancedCtrlSend',
    FORMATTING: 'formatting',
    JOIN_LEAVE: 'joinLeave',
    PREVIEW_FEATURES: 'advancedPreviewFeatures',
    PERFORMANCE_DEBUGGING: 'performanceDebugging',
    SYNC_DRAFTS: 'syncDrafts',
};

export const RHSStates = {
    MENTION: 'mention',
    SEARCH: 'search',
    FLAG: 'flag',
    PIN: 'pin',
    PLUGIN: 'plugin',
    CHANNEL_FILES: 'channel-files',
    CHANNEL_INFO: 'channel-info',
    CHANNEL_MEMBERS: 'channel-members',
    EDIT_HISTORY: 'edit-history',
};

export const UploadStatuses = {
    LOADING: 'loading',
    COMPLETE: 'complete',
    DEFAULT: '',
};

export const GroupUnreadChannels = {
    DISABLED: 'disabled',
    DEFAULT_ON: 'default_on',
    DEFAULT_OFF: 'default_off',
};

export const SidebarChannelGroups = {
    UNREADS: 'unreads',
    FAVORITE: 'favorite',
};

export const DraggingStates = {
    CAPTURE: 'capture',
    BEFORE: 'before',
    DURING: 'during',
};

export const DraggingStateTypes = {
    CATEGORY: 'category',
    CHANNEL: 'channel',
    DM: 'DM',
    MIXED_CHANNELS: 'mixed_channels',
};

export const AboutLinks = {
    TERMS_OF_SERVICE: 'https://mattermost.com/terms-of-use/',
    PRIVACY_POLICY: 'https://mattermost.com/privacy-policy/',
};

export const CloudLinks = {
    BILLING_DOCS: 'https://docs.mattermost.com/cloud/cloud-billing/cloud-billing.html',
    PRICING: 'https://mattermost.com/pricing/',
    PRORATED_PAYMENT: 'https://mattermost.com/pl/mattermost-cloud-prorate-documentation',
    DEPLOYMENT_OPTIONS: 'https://mattermost.com/deploy/',
    DOWNLOAD_UPDATE: 'https://mattermost.com/deploy/',
    CLOUD_SIGNUP_PAGE: 'https://mattermost.com/sign-up/',
    SELF_HOSTED_SIGNUP: 'https://customers.mattermost.com/signup',
    DELINQUENCY_DOCS: 'https://docs.mattermost.com/about/cloud-subscriptions.html#failed-or-late-payments',
    SELF_HOSTED_PRICING: 'https://mattermost.com/pricing/#self-hosted',
};

export const HostedCustomerLinks = {
    BILLING_DOCS: 'https://mattermost.com/pl/how-self-hosted-billing-works',
    SELF_HOSTED_BILLING: 'https://docs.mattermost.com/manage/self-hosted-billing.html',
    TERMS_AND_CONDITIONS: 'https://mattermost.com/enterprise-edition-terms/',
    SECURITY_UPDATES: 'https://mattermost.com/security-updates/',
    DOWNLOAD: 'https://mattermost.com/download',
    NEWSLETTER_UNSUBSCRIBE_LINK: 'https://forms.mattermost.com/UnsubscribePage.html',
    PRIVACY: 'https://mattermost.com/privacy-policy/',
};

export const DocLinks = {
    AD_LDAP: 'https://docs.mattermost.com/configure/configuration-settings.html#ad-ldap',
    DATA_RETENTION_POLICY: 'https://docs.mattermost.com/comply/data-retention-policy.html',
    ELASTICSEARCH: 'https://docs.mattermost.com/scale/elasticsearch.html',
    GUEST_ACCOUNTS: 'https://docs.mattermost.com/onboard/guest-accounts.html',
    SESSION_LENGTHS: 'https://docs.mattermost.com/configure/configuration-settings.html#session-lengths',
    SITE_URL: 'https://docs.mattermost.com/configure/configuration-settings.html#site-url',
    SSL_CERTIFICATE: 'https://docs.mattermost.com/onboard/ssl-client-certificate.html',
    UPGRADE_SERVER: 'https://docs.mattermost.com/upgrade/upgrading-mattermost-server.html',
    ONBOARD_LDAP: 'https://docs.mattermost.com/onboard/ad-ldap.html',
    ONBOARD_SSO: 'https://docs.mattermost.com/onboard/sso-saml.html',
    TRUE_UP_REVIEW: 'https://mattermost.com/pl/true-up-documentation',
    SELF_HOSTED_BILLING: 'https://docs.mattermost.com/manage/self-hosted-billing.html',
    ABOUT_TEAMS: 'https://docs.mattermost.com/welcome/about-teams.html#team-url',
};

export const LicenseLinks = {
    CONTACT_SALES: 'https://mattermost.com/contact-sales/',
    TRIAL_INFO_LINK: 'https://mattermost.com/trial',
    EMBARGOED_COUNTRIES: 'https://mattermost.com/pl/limitations-for-embargoed-countries',
    SOFTWARE_SERVICES_LICENSE_AGREEMENT: 'https://mattermost.com/pl/software-and-services-license-agreement',
    SOFTWARE_SERVICES_LICENSE_AGREEMENT_TEXT: 'Software Services and License Agreement',
};

export const MattermostLink = 'https://mattermost.com/';

export const BillingSchemes = {
    FLAT_FEE: 'flat_fee',
    PER_SEAT: 'per_seat',
    SALES_SERVE: 'sales_serve',
};

export const RecurringIntervals = {
    YEAR: 'year',
    MONTH: 'month',
};

export const PermissionsScope = {
    [Permissions.INVITE_USER]: 'team_scope',
    [Permissions.INVITE_GUEST]: 'team_scope',
    [Permissions.ADD_USER_TO_TEAM]: 'team_scope',
    [Permissions.MANAGE_SLASH_COMMANDS]: 'team_scope',
    [Permissions.MANAGE_OTHERS_SLASH_COMMANDS]: 'team_scope',
    [Permissions.CREATE_PUBLIC_CHANNEL]: 'team_scope',
    [Permissions.CREATE_PRIVATE_CHANNEL]: 'team_scope',
    [Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]: 'channel_scope',
    [Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS]: 'channel_scope',
    [Permissions.ASSIGN_SYSTEM_ADMIN_ROLE]: 'system_scope',
    [Permissions.MANAGE_ROLES]: 'system_scope',
    [Permissions.MANAGE_TEAM_ROLES]: 'team_scope',
    [Permissions.MANAGE_CHANNEL_ROLES]: 'chanel_scope',
    [Permissions.MANAGE_SYSTEM]: 'system_scope',
    [Permissions.CREATE_DIRECT_CHANNEL]: 'system_scope',
    [Permissions.CREATE_GROUP_CHANNEL]: 'system_scope',
    [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: 'channel_scope',
    [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]: 'channel_scope',
    [Permissions.LIST_PUBLIC_TEAMS]: 'system_scope',
    [Permissions.JOIN_PUBLIC_TEAMS]: 'system_scope',
    [Permissions.LIST_PRIVATE_TEAMS]: 'system_scope',
    [Permissions.JOIN_PRIVATE_TEAMS]: 'system_scope',
    [Permissions.LIST_TEAM_CHANNELS]: 'team_scope',
    [Permissions.JOIN_PUBLIC_CHANNELS]: 'team_scope',
    [Permissions.DELETE_PUBLIC_CHANNEL]: 'channel_scope',
    [Permissions.DELETE_PRIVATE_CHANNEL]: 'channel_scope',
    [Permissions.EDIT_OTHER_USERS]: 'system_scope',
    [Permissions.READ_CHANNEL]: 'channel_scope',
    [Permissions.READ_PUBLIC_CHANNEL]: 'team_scope',
    [Permissions.ADD_REACTION]: 'channel_scope',
    [Permissions.REMOVE_REACTION]: 'channel_scope',
    [Permissions.REMOVE_OTHERS_REACTIONS]: 'channel_scope',
    [Permissions.PERMANENT_DELETE_USER]: 'system_scope',
    [Permissions.UPLOAD_FILE]: 'channel_scope',
    [Permissions.GET_PUBLIC_LINK]: 'system_scope',
    [Permissions.MANAGE_INCOMING_WEBHOOKS]: 'team_scope',
    [Permissions.MANAGE_OTHERS_INCOMING_WEBHOOKS]: 'team_scope',
    [Permissions.MANAGE_OUTGOING_WEBHOOKS]: 'team_scope',
    [Permissions.MANAGE_OTHERS_OUTGOING_WEBHOOKS]: 'team_scope',
    [Permissions.MANAGE_OAUTH]: 'system_scope',
    [Permissions.MANAGE_SYSTEM_WIDE_OAUTH]: 'system_scope',
    [Permissions.CREATE_POST]: 'channel_scope',
    [Permissions.CREATE_POST_PUBLIC]: 'channel_scope',
    [Permissions.EDIT_POST]: 'channel_scope',
    [Permissions.EDIT_OTHERS_POSTS]: 'channel_scope',
    [Permissions.DELETE_POST]: 'channel_scope',
    [Permissions.DELETE_OTHERS_POSTS]: 'channel_scope',
    [Permissions.REMOVE_USER_FROM_TEAM]: 'team_scope',
    [Permissions.CREATE_TEAM]: 'system_scope',
    [Permissions.MANAGE_TEAM]: 'team_scope',
    [Permissions.IMPORT_TEAM]: 'team_scope',
    [Permissions.VIEW_TEAM]: 'team_scope',
    [Permissions.LIST_USERS_WITHOUT_TEAM]: 'system_scope',
    [Permissions.CREATE_USER_ACCESS_TOKEN]: 'system_scope',
    [Permissions.READ_USER_ACCESS_TOKEN]: 'system_scope',
    [Permissions.REVOKE_USER_ACCESS_TOKEN]: 'system_scope',
    [Permissions.MANAGE_JOBS]: 'system_scope',
    [Permissions.CREATE_EMOJIS]: 'team_scope',
    [Permissions.DELETE_EMOJIS]: 'team_scope',
    [Permissions.DELETE_OTHERS_EMOJIS]: 'team_scope',
    [Permissions.USE_CHANNEL_MENTIONS]: 'channel_scope',
    [Permissions.USE_GROUP_MENTIONS]: 'channel_scope',
    [Permissions.READ_PUBLIC_CHANNEL_GROUPS]: 'channel_scope',
    [Permissions.READ_PRIVATE_CHANNEL_GROUPS]: 'channel_scope',
    [Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE]: 'channel_scope',
    [Permissions.CONVERT_PRIVATE_CHANNEL_TO_PUBLIC]: 'channel_scope',
    [Permissions.MANAGE_SHARED_CHANNELS]: 'system_scope',
    [Permissions.MANAGE_SECURE_CONNECTIONS]: 'system_scope',
    [Permissions.PLAYBOOK_PUBLIC_CREATE]: 'team_scope',
    [Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES]: 'playbook_scope',
    [Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS]: 'playbook_scope',
    [Permissions.PLAYBOOK_PUBLIC_VIEW]: 'playbook_scope',
    [Permissions.PLAYBOOK_PUBLIC_MAKE_PRIVATE]: 'playbook_scope',
    [Permissions.PLAYBOOK_PRIVATE_CREATE]: 'team_scope',
    [Permissions.PLAYBOOK_PRIVATE_MANAGE_PROPERTIES]: 'playbook_scope',
    [Permissions.PLAYBOOK_PRIVATE_MANAGE_MEMBERS]: 'playbook_scope',
    [Permissions.PLAYBOOK_PRIVATE_VIEW]: 'playbook_scope',
    [Permissions.PLAYBOOK_PRIVATE_MAKE_PUBLIC]: 'playbook_scope',
    [Permissions.RUN_CREATE]: 'playbook_scope',
    [Permissions.RUN_MANAGE_MEMBERS]: 'run_scope',
    [Permissions.RUN_MANAGE_PROPERTIES]: 'run_scope',
    [Permissions.RUN_VIEW]: 'run_scope',
    [Permissions.CREATE_CUSTOM_GROUP]: 'system_scope',
    [Permissions.EDIT_CUSTOM_GROUP]: 'system_scope',
    [Permissions.DELETE_CUSTOM_GROUP]: 'system_scope',
    [Permissions.RESTORE_CUSTOM_GROUP]: 'system_scope',
    [Permissions.MANAGE_CUSTOM_GROUP_MEMBERS]: 'system_scope',
};

export const DefaultRolePermissions = {
    all_users: [
        Permissions.CREATE_DIRECT_CHANNEL,
        Permissions.CREATE_GROUP_CHANNEL,
        Permissions.PERMANENT_DELETE_USER,
        Permissions.CREATE_TEAM,
        Permissions.LIST_TEAM_CHANNELS,
        Permissions.JOIN_PUBLIC_CHANNELS,
        Permissions.READ_PUBLIC_CHANNEL,
        Permissions.VIEW_TEAM,
        Permissions.CREATE_PUBLIC_CHANNEL,
        Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
        Permissions.DELETE_PUBLIC_CHANNEL,
        Permissions.CREATE_PRIVATE_CHANNEL,
        Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
        Permissions.DELETE_PRIVATE_CHANNEL,
        Permissions.INVITE_USER,
        Permissions.ADD_USER_TO_TEAM,
        Permissions.READ_CHANNEL,
        Permissions.ADD_REACTION,
        Permissions.REMOVE_REACTION,
        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
        Permissions.READ_PUBLIC_CHANNEL_GROUPS,
        Permissions.READ_PRIVATE_CHANNEL_GROUPS,
        Permissions.UPLOAD_FILE,
        Permissions.GET_PUBLIC_LINK,
        Permissions.CREATE_POST,
        Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
        Permissions.DELETE_POST,
        Permissions.EDIT_POST,
        Permissions.LIST_PUBLIC_TEAMS,
        Permissions.JOIN_PUBLIC_TEAMS,
        Permissions.USE_CHANNEL_MENTIONS,
        Permissions.USE_GROUP_MENTIONS,
        Permissions.CREATE_CUSTOM_GROUP,
        Permissions.EDIT_CUSTOM_GROUP,
        Permissions.DELETE_CUSTOM_GROUP,
        Permissions.MANAGE_CUSTOM_GROUP_MEMBERS,
        Permissions.PLAYBOOK_PUBLIC_CREATE,
        Permissions.PLAYBOOK_PRIVATE_CREATE,
        Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS,
        Permissions.PLAYBOOK_PRIVATE_MANAGE_MEMBERS,
        Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES,
        Permissions.PLAYBOOK_PRIVATE_MANAGE_PROPERTIES,
        Permissions.PLAYBOOK_PUBLIC_MAKE_PRIVATE,
        Permissions.RUN_CREATE,
    ],
    channel_admin: [
        Permissions.MANAGE_CHANNEL_ROLES,
        Permissions.CREATE_POST,
        Permissions.ADD_REACTION,
        Permissions.REMOVE_REACTION,
        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
        Permissions.READ_PUBLIC_CHANNEL_GROUPS,
        Permissions.READ_PRIVATE_CHANNEL_GROUPS,
        Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
        Permissions.USE_CHANNEL_MENTIONS,
        Permissions.USE_GROUP_MENTIONS,
    ],
    team_admin: [
        Permissions.EDIT_OTHERS_POSTS,
        Permissions.REMOVE_USER_FROM_TEAM,
        Permissions.MANAGE_TEAM,
        Permissions.IMPORT_TEAM,
        Permissions.MANAGE_TEAM_ROLES,
        Permissions.MANAGE_CHANNEL_ROLES,
        Permissions.MANAGE_SLASH_COMMANDS,
        Permissions.MANAGE_OTHERS_SLASH_COMMANDS,
        Permissions.MANAGE_INCOMING_WEBHOOKS,
        Permissions.MANAGE_OUTGOING_WEBHOOKS,
        Permissions.DELETE_POST,
        Permissions.DELETE_OTHERS_POSTS,
        Permissions.MANAGE_OTHERS_OUTGOING_WEBHOOKS,
        Permissions.ADD_REACTION,
        Permissions.MANAGE_OTHERS_INCOMING_WEBHOOKS,
        Permissions.USE_CHANNEL_MENTIONS,
        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
        Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE,
        Permissions.CONVERT_PRIVATE_CHANNEL_TO_PUBLIC,
        Permissions.READ_PUBLIC_CHANNEL_GROUPS,
        Permissions.READ_PRIVATE_CHANNEL_GROUPS,
        Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
        Permissions.CREATE_POST,
        Permissions.REMOVE_REACTION,
        Permissions.USE_GROUP_MENTIONS,
    ],
    guests: [
        Permissions.EDIT_POST,
        Permissions.ADD_REACTION,
        Permissions.REMOVE_REACTION,
        Permissions.USE_CHANNEL_MENTIONS,
        Permissions.READ_CHANNEL,
        Permissions.UPLOAD_FILE,
        Permissions.CREATE_POST,
    ],
};

export const Locations = {
    CENTER: 'CENTER' as const,
    RHS_ROOT: 'RHS_ROOT' as const,
    RHS_COMMENT: 'RHS_COMMENT' as const,
    SEARCH: 'SEARCH' as const,
    NO_WHERE: 'NO_WHERE' as const,
    MODAL: 'MODAL' as const,
};

export const PostListRowListIds = {
    DATE_LINE: PostListUtils.DATE_LINE,
    START_OF_NEW_MESSAGES: PostListUtils.START_OF_NEW_MESSAGES,
    CHANNEL_INTRO_MESSAGE: 'CHANNEL_INTRO_MESSAGE',
    OLDER_MESSAGES_LOADER: 'OLDER_MESSAGES_LOADER',
    NEWER_MESSAGES_LOADER: 'NEWER_MESSAGES_LOADER',
    LOAD_OLDER_MESSAGES_TRIGGER: 'LOAD_OLDER_MESSAGES_TRIGGER',
    LOAD_NEWER_MESSAGES_TRIGGER: 'LOAD_NEWER_MESSAGES_TRIGGER',
};

export const exportFormats = {
    EXPORT_FORMAT_CSV: 'csv',
    EXPORT_FORMAT_ACTIANCE: 'actiance',
    EXPORT_FORMAT_GLOBALRELAY: 'globalrelay',
};

export const ZoomSettings = {
    DEFAULT_SCALE: 1.75,
    SCALE_DELTA: 0.25,
    MIN_SCALE: 0.25,
    MAX_SCALE: 3.0,
};

export const Constants = {
    SettingsTypes,
    JobTypes,
    Preferences,
    SocketEvents,
    ActionTypes,
    UserStatuses,
    UserSearchOptions,
    TutorialSteps,
    AdminTutorialSteps,
    CrtTutorialSteps,
    CrtTutorialTriggerSteps,
    ExploreOtherToolsTourSteps,
    CrtThreadPaneSteps,
    PostTypes,
    ErrorPageTypes,
    AnnouncementBarTypes,
    AnnouncementBarMessages,
    FileTypes,
    Locations,
    PostListRowListIds,
    MAX_POST_VISIBILITY: 1000000,

    IGNORE_POST_TYPES: [PostTypes.JOIN_LEAVE, PostTypes.JOIN_TEAM, PostTypes.LEAVE_TEAM, PostTypes.JOIN_CHANNEL, PostTypes.LEAVE_CHANNEL, PostTypes.REMOVE_FROM_CHANNEL, PostTypes.ADD_REMOVE],

    PayloadSources: keyMirror({
        SERVER_ACTION: null,
        VIEW_ACTION: null,
    }),

    // limit of users to show the lhs invite members button highlighted
    USER_LIMIT: 10,

    StatTypes,
    STAT_MAX_ACTIVE_USERS: 20,
    STAT_MAX_NEW_USERS: 20,

    ScrollTypes: {
        FREE: 1,
        BOTTOM: 2,
        SIDEBBAR_OPEN: 3,
        NEW_MESSAGE: 4,
        POST: 5,
    },

    // This is the same limit set https://github.com/mattermost/mattermost-server/blob/master/model/config.go#L105
    MAXIMUM_LOGIN_ATTEMPTS_DEFAULT: 10,

    // This is the same limit set https://github.com/mattermost/mattermost-server/blob/master/api4/team.go#L23
    MAX_ADD_MEMBERS_BATCH: 256,

    SPECIAL_MENTIONS: ['all', 'channel', 'here'],
    PLAN_MENTIONS: /Professional plan|Enterprise plan|Enterprise trial/gi,
    SPECIAL_MENTIONS_REGEX: /(?:\B|\b_+)@(channel|all|here)(?!(\.|-|_)*[^\W_])/gi,
    SUM_OF_MEMBERS_MENTION_REGEX: /\d+ members/gi,
    ALL_MENTION_REGEX: /(?:\B|\b_+)@(all)(?!(\.|-|_)*[^\W_])/gi,
    CHANNEL_MENTION_REGEX: /(?:\B|\b_+)@(channel)(?!(\.|-|_)*[^\W_])/gi,
    HERE_MENTION_REGEX: /(?:\B|\b_+)@(here)(?!(\.|-|_)*[^\W_])/gi,
    NOTIFY_ALL_MEMBERS: 5,
    ALL_MEMBERS_MENTIONS_REGEX: /(?:\B|\b_+)@(channel|all)(?!(\.|-|_)*[^\W_])/gi,
    MENTIONS_REGEX: /(?:\B|\b_+)@([a-z0-9.\-_]+)/gi,
    DEFAULT_CHARACTER_LIMIT: 4000,
    IMAGE_TYPE_GIF: 'gif',
    TEXT_TYPES: ['txt', 'rtf'],
    IMAGE_TYPES: ['jpg', 'gif', 'bmp', 'png', 'jpeg', 'tiff', 'tif', 'psd'],
    AUDIO_TYPES: ['mp3', 'wav', 'wma', 'm4a', 'flac', 'aac', 'ogg', 'm4r'],
    VIDEO_TYPES: ['mp4', 'avi', 'webm', 'mkv', 'wmv', 'mpg', 'mov', 'flv'],
    PRESENTATION_TYPES: ['ppt', 'pptx'],
    SPREADSHEET_TYPES: ['xlsx', 'csv'],
    WORD_TYPES: ['doc', 'docx'],
    CHANNEL_HEADER_HEIGHT: 62,
    CODE_TYPES: ['applescript', 'as', 'atom', 'bas', 'bash', 'boot', 'c', 'c++', 'cake', 'cc', 'cjsx', 'cl2', 'clj', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', '_coffee', 'coffee', 'cpp', 'cs', 'csharp', 'cson', 'css', 'd', 'dart', 'delphi', 'dfm', 'di', 'diff', 'django', 'docker', 'dockerfile', 'dpr', 'erl', 'ex', 'exs', 'f90', 'f95', 'freepascal', 'fs', 'fsharp', 'gcode', 'gemspec', 'go', 'groovy', 'gyp', 'h', 'h++', 'handlebars', 'hbs', 'hic', 'hpp', 'hs', 'html', 'html.handlebars', 'html.hbs', 'hx', 'iced', 'irb', 'java', 'jinja', 'jl', 'js', 'json', 'jsp', 'jsx', 'kt', 'ktm', 'kts', 'lazarus', 'less', 'lfm', 'lisp', 'log', 'lpr', 'lua', 'm', 'mak', 'matlab', 'md', 'mk', 'mkd', 'mkdown', 'ml', 'mm', 'nc', 'obj-c', 'objc', 'osascript', 'pas', 'pascal', 'perl', 'php', 'php3', 'php4', 'php5', 'php6', 'pl', 'plist', 'podspec', 'pp', 'ps', 'ps1', 'py', 'r', 'rb', 'rs', 'rss', 'ruby', 'scala', 'scm', 'scpt', 'scss', 'sh', 'sld', 'sql', 'st', 'styl', 'swift', 'tex', 'thor', 'v', 'vb', 'vbnet', 'vbs', 'veo', 'xhtml', 'xml', 'xsl', 'yaml', 'zsh'],
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
        other: genericIcon,
    },
    ICON_NAME_FROM_TYPE: {
        text: 'text',
        audio: 'audio',
        video: 'video',
        spreadsheet: 'excel',
        presentation: 'ppt',
        pdf: 'pdf',
        code: 'code',
        word: 'word',
        patch: 'patch',
        other: 'generic',
        image: 'image',
    },
    MAX_UPLOAD_FILES: 10,
    MAX_FILENAME_LENGTH: 35,
    EXPANDABLE_INLINE_IMAGE_MIN_HEIGHT: 100,
    THUMBNAIL_WIDTH: 128,
    THUMBNAIL_HEIGHT: 100,
    PREVIEWER_HEIGHT: 170,
    WEB_VIDEO_WIDTH: 640,
    WEB_VIDEO_HEIGHT: 480,
    MOBILE_VIDEO_WIDTH: 480,
    MOBILE_VIDEO_HEIGHT: 360,

    DESKTOP_SCREEN_WIDTH: 1679,
    TABLET_SCREEN_WIDTH: 1020,
    MOBILE_SCREEN_WIDTH: 768,

    POST_MODAL_PADDING: 170,
    SCROLL_DELAY: 2000,
    SCROLL_PAGE_FRACTION: 3,
    DEFAULT_CHANNEL: 'town-square',
    DEFAULT_CHANNEL_UI_NAME: 'Town Square',
    OFFTOPIC_CHANNEL: 'off-topic',
    OFFTOPIC_CHANNEL_UI_NAME: 'Off-Topic',
    GITLAB_SERVICE: 'gitlab',
    GOOGLE_SERVICE: 'google',
    OFFICE365_SERVICE: 'office365',
    OAUTH_SERVICES: ['gitlab', 'google', 'office365', 'openid'],
    OPENID_SERVICE: 'openid',
    OPENID_SERVICE_FEATURE_DISCOVERY: 'openid_feature_discovery',
    OPENID_SCOPES: 'profile openid email',
    EMAIL_SERVICE: 'email',
    LDAP_SERVICE: 'ldap',
    SAML_SERVICE: 'saml',
    USERNAME_SERVICE: 'username',
    SIGNIN_CHANGE: 'signin_change',
    PASSWORD_CHANGE: 'password_change',
    GET_TERMS_ERROR: 'get_terms_error',
    TERMS_REJECTED: 'terms_rejected',
    SIGNIN_VERIFIED: 'verified',
    CREATE_LDAP: 'create_ldap',
    SESSION_EXPIRED: 'expired',
    POST_AREA_HEIGHT: 80,
    POST_CHUNK_SIZE: 60,
    PROFILE_CHUNK_SIZE: 100,
    POST_FOCUS_CONTEXT_RADIUS: 10,
    POST_LOADING: 'loading',
    POST_FAILED: 'failed',
    POST_DELETED: 'deleted',
    POST_UPDATED: 'updated',
    SYSTEM_MESSAGE_PREFIX: 'system_',
    SUGGESTION_LIST_MAXHEIGHT: 292,
    SUGGESTION_LIST_MAXWIDTH: 496,
    SUGGESTION_LIST_SPACE_RHS: 420,
    SUGGESTION_LIST_MODAL_WIDTH: 496,
    MENTION_NAME_PADDING_LEFT: 2.4,
    AVATAR_WIDTH: 24,
    AUTO_RESPONDER: 'system_auto_responder',
    SYSTEM_MESSAGE_PROFILE_IMAGE: logoImage,
    RESERVED_TEAM_NAMES: [
        'signup',
        'login',
        'admin',
        'channel',
        'post',
        'api',
        'oauth',
        'error',
        'help',
        'plugins',
        'playbooks',
        'boards',
    ],
    RESERVED_USERNAMES: [
        'valet',
        'all',
        'channel',
        'here',
        'matterbot',
        'system',
    ],
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    MAX_DMS: 20,
    MAX_USERS_IN_GM: 8,
    MIN_USERS_IN_GM: 3,
    MAX_CHANNEL_POPOVER_COUNT: 100,
    DM_AND_GM_SHOW_COUNTS: [10, 15, 20, 40],
    HIGHEST_DM_SHOW_COUNT: 10000,
    DM_CHANNEL: 'D',
    GM_CHANNEL: 'G',
    OPEN_CHANNEL: 'O',
    PRIVATE_CHANNEL: 'P',
    ARCHIVED_CHANNEL: 'archive',
    INVITE_TEAM: 'I',
    OPEN_TEAM: 'O',
    THREADS: 'threads',
    INSIGHTS: 'insights',
    MAX_POST_LEN: 4000,
    EMOJI_SIZE: 16,
    DEFAULT_EMOJI_PICKER_LEFT_OFFSET: 87,
    DEFAULT_EMOJI_PICKER_RIGHT_OFFSET: 15,
    EMOJI_PICKER_WIDTH_OFFSET: 295,
    THEME_ELEMENTS: [
        {
            group: 'sidebarElements',
            id: 'sidebarBg',
            uiName: 'Sidebar BG',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarText',
            uiName: 'Sidebar Text',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarHeaderBg',
            uiName: 'Sidebar Header BG',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTeamBarBg',
            uiName: 'Team Sidebar BG',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarHeaderTextColor',
            uiName: 'Sidebar Header Text',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarUnreadText',
            uiName: 'Sidebar Unread Text',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextHoverBg',
            uiName: 'Sidebar Text Hover BG',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextActiveBorder',
            uiName: 'Sidebar Text Active Border',
        },
        {
            group: 'sidebarElements',
            id: 'sidebarTextActiveColor',
            uiName: 'Sidebar Text Active Color',
        },
        {
            group: 'sidebarElements',
            id: 'onlineIndicator',
            uiName: 'Online Indicator',
        },
        {
            group: 'sidebarElements',
            id: 'awayIndicator',
            uiName: 'Away Indicator',
        },
        {
            group: 'sidebarElements',
            id: 'dndIndicator',
            uiName: 'Away Indicator',
        },
        {
            group: 'sidebarElements',
            id: 'mentionBg',
            uiName: 'Mention Jewel BG',
        },
        {
            group: 'sidebarElements',
            id: 'mentionColor',
            uiName: 'Mention Jewel Text',
        },
        {
            group: 'centerChannelElements',
            id: 'centerChannelBg',
            uiName: 'Center Channel BG',
        },
        {
            group: 'centerChannelElements',
            id: 'centerChannelColor',
            uiName: 'Center Channel Text',
        },
        {
            group: 'centerChannelElements',
            id: 'newMessageSeparator',
            uiName: 'New Message Separator',
        },
        {
            group: 'centerChannelElements',
            id: 'errorTextColor',
            uiName: 'Error Text Color',
        },
        {
            group: 'centerChannelElements',
            id: 'mentionHighlightBg',
            uiName: 'Mention Highlight BG',
        },
        {
            group: 'linkAndButtonElements',
            id: 'linkColor',
            uiName: 'Link Color',
        },
        {
            group: 'centerChannelElements',
            id: 'mentionHighlightLink',
            uiName: 'Mention Highlight Link',
        },
        {
            group: 'linkAndButtonElements',
            id: 'buttonBg',
            uiName: 'Button BG',
        },
        {
            group: 'linkAndButtonElements',
            id: 'buttonColor',
            uiName: 'Button Text',
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
                    iconURL: solarizedDarkIcon,
                },
                {
                    id: 'solarized-light',
                    uiName: 'Solarized Light',
                    cssURL: solarizedLightCSS,
                    iconURL: solarizedLightIcon,
                },
                {
                    id: 'github',
                    uiName: 'GitHub',
                    cssURL: githubCSS,
                    iconURL: githubIcon,
                },
                {
                    id: 'monokai',
                    uiName: 'Monokai',
                    cssURL: monokaiCSS,
                    iconURL: monokaiIcon,
                },
            ],
        },
    ],
    DEFAULT_CODE_THEME: 'github',

    // KeyCodes
    //  key[0]: used for KeyboardEvent.key
    //  key[1]: used for KeyboardEvent.keyCode
    //  key[2]: used for KeyboardEvent.code

    //  KeyboardEvent.code is used as primary check to support multiple keyborad layouts
    //  support of KeyboardEvent.code is just in chrome and firefox so using key and keyCode for better browser support

    KeyCodes: ({
        BACKSPACE: ['Backspace', 8],
        TAB: ['Tab', 9],
        ENTER: ['Enter', 13],
        SHIFT: ['Shift', 16],
        CTRL: ['Control', 17],
        ALT: ['Alt', 18],
        CAPS_LOCK: ['CapsLock', 20],
        ESCAPE: ['Escape', 27],
        SPACE: [' ', 32],
        PAGE_UP: ['PageUp', 33],
        PAGE_DOWN: ['PageDown', 34],
        END: ['End', 35],
        HOME: ['Home', 36],
        LEFT: ['ArrowLeft', 37],
        UP: ['ArrowUp', 38],
        RIGHT: ['ArrowRight', 39],
        DOWN: ['ArrowDown', 40],
        INSERT: ['Insert', 45],
        DELETE: ['Delete', 46],
        ZERO: ['0', 48],
        ONE: ['1', 49],
        TWO: ['2', 50],
        THREE: ['3', 51],
        FOUR: ['4', 52],
        FIVE: ['5', 53],
        SIX: ['6', 54],
        SEVEN: ['7', 55],
        EIGHT: ['8', 56],
        NINE: ['9', 57],
        A: ['a', 65],
        B: ['b', 66],
        C: ['c', 67],
        D: ['d', 68],
        E: ['e', 69],
        F: ['f', 70],
        G: ['g', 71],
        H: ['h', 72],
        I: ['i', 73],
        J: ['j', 74],
        K: ['k', 75],
        L: ['l', 76],
        M: ['m', 77],
        N: ['n', 78],
        O: ['o', 79],
        P: ['p', 80],
        Q: ['q', 81],
        R: ['r', 82],
        S: ['s', 83],
        T: ['t', 84],
        U: ['u', 85],
        V: ['v', 86],
        W: ['w', 87],
        X: ['x', 88],
        Y: ['y', 89],
        Z: ['z', 90],
        CMD: ['Meta', 91],
        MENU: ['ContextMenu', 93],
        NUMPAD_0: ['0', 96],
        NUMPAD_1: ['1', 97],
        NUMPAD_2: ['2', 98],
        NUMPAD_3: ['3', 99],
        NUMPAD_4: ['4', 100],
        NUMPAD_5: ['5', 101],
        NUMPAD_6: ['6', 102],
        NUMPAD_7: ['7', 103],
        NUMPAD_8: ['8', 104],
        NUMPAD_9: ['9', 105],
        MULTIPLY: ['*', 106],
        ADD: ['+', 107],
        SUBTRACT: ['-', 109],
        DECIMAL: ['.', 110],
        DIVIDE: ['/', 111],
        F1: ['F1', 112],
        F2: ['F2', 113],
        F3: ['F3', 114],
        F4: ['F4', 115],
        F5: ['F5', 116],
        F6: ['F6', 117],
        F7: ['F7', 118],
        F8: ['F8', 119],
        F9: ['F9', 120],
        F10: ['F10', 121],
        F11: ['F11', 122],
        F12: ['F12', 123],
        NUM_LOCK: ['NumLock', 144],
        SEMICOLON: [';', 186],
        EQUAL: ['=', 187],
        COMMA: [',', 188],
        DASH: ['-', 189],
        PERIOD: ['.', 190],
        FORWARD_SLASH: ['/', 191],
        TILDE: ['~', 192], // coudnt find the key or even get code from browser - no reference in code as of now
        OPEN_BRACKET: ['[', 219],
        BACK_SLASH: ['\\', 220],
        CLOSE_BRACKET: [']', 221],
        COMPOSING: ['Composing', 229],
    } as Record<string, [string, number]>),
    CODE_PREVIEW_MAX_FILE_SIZE: 500000, // 500 KB
    HighlightedLanguages: {
        '1c': {name: '1C:Enterprise', extensions: ['bsl', 'os'], aliases: ['bsl']},
        actionscript: {name: 'ActionScript', extensions: ['as'], aliases: ['as', 'as3']},
        applescript: {name: 'AppleScript', extensions: ['applescript', 'osascript', 'scpt'], aliases: ['osascript']},
        bash: {name: 'Bash', extensions: ['sh'], aliases: ['sh', 'zsh']},
        clojure: {name: 'Clojure', extensions: ['clj', 'boot', 'cl2', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', 'hic'], aliases: ['clj']},
        coffeescript: {name: 'CoffeeScript', extensions: ['coffee', '_coffee', 'cake', 'cjsx', 'cson', 'iced'], aliases: ['coffee', 'coffee-script']},
        cpp: {name: 'C/C++', extensions: ['cpp', 'c', 'cc', 'h', 'c++', 'h++', 'hpp'], aliases: ['c++', 'c']},
        csharp: {name: 'C#', extensions: ['cs', 'csharp'], aliases: ['c#', 'cs', 'csharp']},
        css: {name: 'CSS', extensions: ['css']},
        d: {name: 'D', extensions: ['d', 'di'], aliases: ['dlang']},
        dart: {name: 'Dart', extensions: ['dart']},
        delphi: {name: 'Delphi', extensions: ['delphi', 'dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm'], aliases: ['pas', 'pascal']},
        diff: {name: 'Diff', extensions: ['diff', 'patch'], aliases: ['patch', 'udiff']},
        django: {name: 'Django', extensions: ['django', 'jinja'], aliases: ['jinja']},
        dockerfile: {name: 'Dockerfile', extensions: ['dockerfile', 'docker'], aliases: ['docker']},
        elixir: {name: 'Elixir', extensions: ['ex', 'exs'], aliases: ['ex', 'exs']},
        erlang: {name: 'Erlang', extensions: ['erl'], aliases: ['erl']},
        fortran: {name: 'Fortran', extensions: ['f90', 'f95'], aliases: ['f90', 'f95']},
        fsharp: {name: 'F#', extensions: ['fsharp', 'fs'], aliases: ['fs']},
        gcode: {name: 'G-Code', extensions: ['gcode', 'nc']},
        go: {name: 'Go', extensions: ['go'], aliases: ['golang']},
        groovy: {name: 'Groovy', extensions: ['groovy']},
        handlebars: {name: 'Handlebars', extensions: ['handlebars', 'hbs', 'html.hbs', 'html.handlebars'], aliases: ['hbs', 'mustache']},
        haskell: {name: 'Haskell', extensions: ['hs'], aliases: ['hs']},
        haxe: {name: 'Haxe', extensions: ['hx'], aliases: ['hx']},
        java: {name: 'Java', extensions: ['java', 'jsp']},
        javascript: {name: 'JavaScript', extensions: ['js', 'jsx'], aliases: ['js']},
        json: {name: 'JSON', extensions: ['json']},
        julia: {name: 'Julia', extensions: ['jl'], aliases: ['jl']},
        kotlin: {name: 'Kotlin', extensions: ['kt', 'ktm', 'kts'], aliases: ['kt']},
        latex: {name: 'LaTeX', extensions: ['tex'], aliases: ['tex']},
        less: {name: 'Less', extensions: ['less']},
        lisp: {name: 'Lisp', extensions: ['lisp']},
        lua: {name: 'Lua', extensions: ['lua']},
        makefile: {name: 'Makefile', extensions: ['mk', 'mak'], aliases: ['make', 'mf', 'gnumake', 'bsdmake', 'mk']},
        markdown: {name: 'Markdown', extensions: ['md', 'mkdown', 'mkd'], aliases: ['md', 'mkd']},
        matlab: {name: 'Matlab', extensions: ['matlab', 'm'], aliases: ['m']},
        objectivec: {name: 'Objective C', extensions: ['mm', 'objc', 'obj-c'], aliases: ['objective_c', 'objc']},
        ocaml: {name: 'OCaml', extensions: ['ml'], aliases: ['ml']},
        perl: {name: 'Perl', extensions: ['perl', 'pl'], aliases: ['pl']},
        pgsql: {name: 'PostgreSQL', extensions: ['pgsql', 'postgres', 'postgresql'], aliases: ['postgres', 'postgresql']},
        php: {name: 'PHP', extensions: ['php', 'php3', 'php4', 'php5', 'php6'], aliases: ['php3', 'php4', 'php5', 'php6']},
        powershell: {name: 'PowerShell', extensions: ['ps', 'ps1'], aliases: ['posh']},
        puppet: {name: 'Puppet', extensions: ['pp'], aliases: ['pp']},
        python: {name: 'Python', extensions: ['py', 'gyp'], aliases: ['py']},
        r: {name: 'R', extensions: ['r'], aliases: ['r', 's']},
        ruby: {name: 'Ruby', extensions: ['ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb'], aliases: ['rb']},
        rust: {name: 'Rust', extensions: ['rs'], aliases: ['rs']},
        scala: {name: 'Scala', extensions: ['scala']},
        scheme: {name: 'Scheme', extensions: ['scm', 'sld'], aliases: ['scm']},
        scss: {name: 'SCSS', extensions: ['scss']},
        smalltalk: {name: 'Smalltalk', extensions: ['st'], aliases: ['st', 'squeak']},
        sql: {name: 'SQL', extensions: ['sql']},
        stylus: {name: 'Stylus', extensions: ['styl'], aliases: ['styl']},
        swift: {name: 'Swift', extensions: ['swift']},
        text: {name: 'Text', extensions: ['txt', 'log'], aliases: ['txt']},
        typescript: {name: 'TypeScript', extensions: ['ts', 'tsx'], aliases: ['ts', 'tsx']},
        vbnet: {name: 'VB.Net', extensions: ['vbnet', 'vb', 'bas'], aliases: ['vb', 'visualbasic']},
        vbscript: {name: 'VBScript', extensions: ['vbs'], aliases: ['vbs']},
        verilog: {name: 'Verilog', extensions: ['v', 'veo', 'sv', 'svh']},
        vhdl: {name: 'VHDL', extensions: ['vhd', 'vhdl'], aliases: ['vhd']},
        xml: {name: 'HTML, XML', extensions: ['xml', 'html', 'xhtml', 'rss', 'atom', 'xsl', 'plist']},
        yaml: {name: 'YAML', extensions: ['yaml'], aliases: ['yml']},
    },
    PostsViewJumpTypes: {
        BOTTOM: 1,
        POST: 2,
        SIDEBAR_OPEN: 3,
    },
    NotificationPrefs: {
        MENTION: 'mention',
    },
    Integrations: {
        COMMAND: 'commands',
        PAGE_SIZE: '10000',
        START_PAGE_NUM: 0,
        INCOMING_WEBHOOK: 'incoming_webhooks',
        OUTGOING_WEBHOOK: 'outgoing_webhooks',
        OAUTH_APP: 'oauth2-apps',
        BOT: 'bots',
        EXECUTE_CURRENT_COMMAND_ITEM_ID: '_execute_current_command',
        OPEN_COMMAND_IN_MODAL_ITEM_ID: '_open_command_in_modal',
        COMMAND_SUGGESTION_ERROR: 'error',
        COMMAND_SUGGESTION_CHANNEL: 'channel',
        COMMAND_SUGGESTION_USER: 'user',
    },
    FeatureTogglePrefix: 'feature_enabled_',
    PRE_RELEASE_FEATURES: {
        MARKDOWN_PREVIEW: {
            label: 'markdown_preview', // github issue: https://github.com/mattermost/platform/pull/1389
            description: 'Show markdown preview option in message input box',
        },
    },
    OVERLAY_TIME_DELAY_SMALL: 100,
    OVERLAY_TIME_DELAY: 400,
    OVERLAY_DEFAULT_TRIGGER: ['hover', 'focus'],
    PERMALINK_FADEOUT: 5000,
    DEFAULT_MAX_USERS_PER_TEAM: 50,
    DEFAULT_MAX_CHANNELS_PER_TEAM: 2000,
    DEFAULT_MAX_NOTIFICATIONS_PER_CHANNEL: 1000,
    MIN_TEAMNAME_LENGTH: 2,
    MAX_TEAMNAME_LENGTH: 64,
    MAX_TEAMDESCRIPTION_LENGTH: 50,
    MIN_CHANNELNAME_LENGTH: 1,
    MAX_CHANNELNAME_LENGTH: 64,
    DEFAULT_CHANNELURL_SHORTEN_LENGTH: 52,
    MAX_CHANNELPURPOSE_LENGTH: 250,
    MAX_FIRSTNAME_LENGTH: 64,
    MAX_LASTNAME_LENGTH: 64,
    MAX_EMAIL_LENGTH: 128,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 22,
    MAX_NICKNAME_LENGTH: 22,
    MIN_PASSWORD_LENGTH: 5,
    MAX_PASSWORD_LENGTH: 64,
    MAX_POSITION_LENGTH: 128,
    MIN_TRIGGER_LENGTH: 1,
    MAX_TRIGGER_LENGTH: 128,
    MAX_SITENAME_LENGTH: 30,
    MAX_CUSTOM_BRAND_TEXT_LENGTH: 500,
    MAX_TERMS_OF_SERVICE_TEXT_LENGTH: 16383,
    DEFAULT_TERMS_OF_SERVICE_RE_ACCEPTANCE_PERIOD: 365,
    EMOJI_PATH: '/static/emoji',
    RECENT_EMOJI_KEY: 'recentEmojis',
    DEFAULT_WEBHOOK_LOGO: logoWebhook,
    MHPNS: 'https://push.mattermost.com',
    MTPNS: 'https://push-test.mattermost.com',
    MAX_PREV_MSGS: 100,
    POST_COLLAPSE_TIMEOUT: 1000 * 60 * 5, // five minutes
    SAVE_DRAFT_TIMEOUT: 500,
    PERMISSIONS_ALL: 'all',
    PERMISSIONS_CHANNEL_ADMIN: 'channel_admin',
    PERMISSIONS_TEAM_ADMIN: 'team_admin',
    PERMISSIONS_SYSTEM_ADMIN: 'system_admin',
    PERMISSIONS_SYSTEM_READ_ONLY_ADMIN: 'system_read_only_admin',
    PERMISSIONS_SYSTEM_USER_MANAGER: 'system_user_manager',
    PERMISSIONS_SYSTEM_MANAGER: 'system_manager',
    PERMISSIONS_DELETE_POST_ALL: 'all',
    PERMISSIONS_DELETE_POST_TEAM_ADMIN: 'team_admin',
    PERMISSIONS_DELETE_POST_SYSTEM_ADMIN: 'system_admin',
    PERMISSIONS_SYSTEM_CUSTOM_GROUP_ADMIN: 'system_custom_group_admin',
    ALLOW_EDIT_POST_ALWAYS: 'always',
    ALLOW_EDIT_POST_NEVER: 'never',
    ALLOW_EDIT_POST_TIME_LIMIT: 'time_limit',
    UNSET_POST_EDIT_TIME_LIMIT: -1,
    MENTION_CHANNELS: 'mention.channels',
    MENTION_MORE_CHANNELS: 'mention.morechannels',
    MENTION_UNREAD_CHANNELS: 'mention.unread.channels',
    MENTION_UNREAD: 'mention.unread',
    MENTION_MEMBERS: 'mention.members',
    MENTION_MORE_MEMBERS: 'mention.moremembers',
    MENTION_NONMEMBERS: 'mention.nonmembers',
    MENTION_PUBLIC_CHANNELS: 'mention.public.channels',
    MENTION_PRIVATE_CHANNELS: 'mention.private.channels',
    MENTION_RECENT_CHANNELS: 'mention.recent.channels',
    MENTION_SPECIAL: 'mention.special',
    MENTION_GROUPS: 'search.group',
    DEFAULT_NOTIFICATION_DURATION: 5000,
    STATUS_INTERVAL: 60000,
    AUTOCOMPLETE_TIMEOUT: 100,
    AUTOCOMPLETE_SPLIT_CHARACTERS: ['.', '-', '_'],
    ANIMATION_TIMEOUT: 1000,
    SEARCH_TIMEOUT_MILLISECONDS: 100,
    TELEMETRY_RUDDER_KEY: 'placeholder_rudder_key',
    TELEMETRY_RUDDER_DATAPLANE_URL: 'placeholder_rudder_dataplane_url',
    TEAMMATE_NAME_DISPLAY: {
        SHOW_USERNAME: 'username',
        SHOW_NICKNAME_FULLNAME: 'nickname_full_name',
        SHOW_FULLNAME: 'full_name',
    },
    SEARCH_POST: 'searchpost',
    CHANNEL_ID_LENGTH: 26,
    TRANSPARENT_PIXEL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    TRIPLE_BACK_TICKS: /```/g,
    MAX_ATTACHMENT_FOOTER_LENGTH: 300,
    ACCEPT_STATIC_IMAGE: '.jpeg,.jpg,.png,.bmp',
    ACCEPT_EMOJI_IMAGE: '.jpeg,.jpg,.png,.gif',
    THREADS_PAGE_SIZE: 25,
    THREADS_LOADING_INDICATOR_ITEM_ID: 'threads_loading_indicator_item_id',
    THREADS_NO_RESULTS_ITEM_ID: 'threads_no_results_item_id',
    TRIAL_MODAL_AUTO_SHOWN: 'trial_modal_auto_shown',
    DEFAULT_SITE_URL: 'http://localhost:8065',
    CHANNEL_HEADER_BUTTON_DISABLE_TIMEOUT: 1000,
    FIRST_ADMIN_ROLE: 'first_admin',
    MAX_PURCHASE_SEATS: 1000000,
    MIN_PURCHASE_SEATS: 10,
};

export const ValidationErrors = {
    USERNAME_REQUIRED: 'USERNAME_REQUIRED',
    INVALID_LENGTH: 'INVALID_LENGTH',
    INVALID_CHARACTERS: 'INVALID_CHARACTERS',
    INVALID_FIRST_CHARACTER: 'INVALID_FIRST_CHARACTER',
    RESERVED_NAME: 'RESERVED_NAME',
    INVALID_LAST_CHARACTER: 'INVALID_LAST_CHARACTER',
};

export const ConsolePages = {
    AD_LDAP: '/admin_console/authentication/ldap',
    COMPLIANCE_EXPORT: '/admin_console/compliance/export',
    CUSTOM_TERMS: '/admin_console/compliance/custom_terms_of_service',
    DATA_RETENTION: '/admin_console/compliance/data_retention_settings',
    ELASTICSEARCH: '/admin_console/environment/elasticsearch',
    GUEST_ACCOUNTS: '/admin_console/authentication/guest_access',
    LICENSE: '/admin_console/about/license',
    SAML: '/admin_console/authentication/saml',
    SESSION_LENGTHS: '/admin_console/environment/session_lengths',
    WEB_SERVER: '/admin_console/environment/web_server',
    PUSH_NOTIFICATION_CENTER: '/admin_console/environment/push_notification_server',
    SMTP: '/admin_console/environment/smtp',
    PAYMENT_INFO: '/admin_console/billing/payment_info',
    BILLING_HISTORY: '/admin_console/billing/billing_history',
};

export const WindowSizes = {
    MOBILE_VIEW: 'mobileView',
    TABLET_VIEW: 'tabletView',
    SMALL_DESKTOP_VIEW: 'smallDesktopView',
    DESKTOP_VIEW: 'desktopView',
};

export const AcceptedProfileImageTypes = ['image/jpeg', 'image/png', 'image/bmp'];

export const searchHintOptions = [{searchTerm: 'From:', message: {id: t('search_list_option.from'), defaultMessage: 'Messages from a user'}},
    {searchTerm: 'In:', message: {id: t('search_list_option.in'), defaultMessage: 'Messages in a channel'}},
    {searchTerm: 'On:', message: {id: t('search_list_option.on'), defaultMessage: 'Messages on a date'}},
    {searchTerm: 'Before:', message: {id: t('search_list_option.before'), defaultMessage: 'Messages before a date'}},
    {searchTerm: 'After:', message: {id: t('search_list_option.after'), defaultMessage: 'Messages after a date'}},
    {searchTerm: '-', message: {id: t('search_list_option.exclude'), defaultMessage: 'Exclude search terms'}, additionalDisplay: '—'},
    {searchTerm: '""', message: {id: t('search_list_option.phrases'), defaultMessage: 'Messages with phrases'}},
];

export const searchFilesHintOptions = [{searchTerm: 'From:', message: {id: t('search_files_list_option.from'), defaultMessage: 'Files from a user'}},
    {searchTerm: 'In:', message: {id: t('search_files_list_option.in'), defaultMessage: 'Files in a channel'}},
    {searchTerm: 'On:', message: {id: t('search_files_list_option.on'), defaultMessage: 'Files on a date'}},
    {searchTerm: 'Before:', message: {id: t('search_files_list_option.before'), defaultMessage: 'Files before a date'}},
    {searchTerm: 'After:', message: {id: t('search_files_list_option.after'), defaultMessage: 'Files after a date'}},
    {searchTerm: 'Ext:', message: {id: t('search_files_list_option.ext'), defaultMessage: 'Files with a extension'}},
    {searchTerm: '-', message: {id: t('search_files_list_option.exclude'), defaultMessage: 'Exclude search terms'}, additionalDisplay: '—'},
    {searchTerm: '""', message: {id: t('search_files_list_option.phrases'), defaultMessage: 'Files with phrases'}},
];

// adding these rtranslations here so the weblate CI step will not fail with empty translation strings
t('suggestion.archive');
t('suggestion.mention.channels');
t('suggestion.mention.morechannels');
t('suggestion.mention.unread.channels');
t('suggestion.mention.unread');
t('suggestion.mention.members');
t('suggestion.mention.moremembers');
t('suggestion.mention.nonmembers');
t('suggestion.mention.private.channels');
t('suggestion.mention.recent.channels');
t('suggestion.mention.special');
t('suggestion.mention.groups');
t('suggestion.search.public');
t('suggestion.search.group');
t('suggestion.commands');
t('suggestion.emoji');

const {
    DONT_CLEAR,
    THIRTY_MINUTES,
    ONE_HOUR,
    FOUR_HOURS,
    TODAY,
    THIS_WEEK,
    DATE_AND_TIME,
    CUSTOM_DATE_TIME,
} = CustomStatusDuration;

export const durationValues = {
    [DONT_CLEAR]: {
        id: t('custom_status.expiry_dropdown.dont_clear'),
        defaultMessage: "Don't clear",
    },
    [THIRTY_MINUTES]: {
        id: t('custom_status.expiry_dropdown.thirty_minutes'),
        defaultMessage: '30 minutes',
    },
    [ONE_HOUR]: {
        id: t('custom_status.expiry_dropdown.one_hour'),
        defaultMessage: '1 hour',
    },
    [FOUR_HOURS]: {
        id: t('custom_status.expiry_dropdown.four_hours'),
        defaultMessage: '4 hours',
    },
    [TODAY]: {
        id: t('custom_status.expiry_dropdown.today'),
        defaultMessage: 'Today',
    },
    [THIS_WEEK]: {
        id: t('custom_status.expiry_dropdown.this_week'),
        defaultMessage: 'This week',
    },
    [DATE_AND_TIME]: {
        id: t('custom_status.expiry_dropdown.date_and_time'),
        defaultMessage: 'Custom Date and Time',
    },
    [CUSTOM_DATE_TIME]: {
        id: t('custom_status.expiry_dropdown.date_and_time'),
        defaultMessage: 'Custom Date and Time',
    },
};

export const InsightsScopes = {
    MY: 'MY',
    TEAM: 'TEAM',
};

export const InsightsCardTitles = {
    TOP_CHANNELS: {
        teamTitle: {
            id: t('insights.topChannels.title'),
            defaultMessage: 'Top channels',
        },
        myTitle: {
            id: t('insights.topChannels.myTitle'),
            defaultMessage: 'My top channels',
        },
        teamSubTitle: {
            id: t('insights.topChannels.subTitle'),
            defaultMessage: 'Most active channels for the team',
        },
        mySubTitle: {
            id: t('insights.topChannels.mySubTitle'),
            defaultMessage: 'Most active channels that I\'m a member of',
        },
    },
    TOP_REACTIONS: {
        teamTitle: {
            id: t('insights.topReactions.title'),
            defaultMessage: 'Top reactions',
        },
        myTitle: {
            id: t('insights.topReactions.myTitle'),
            defaultMessage: 'My top reactions',
        },
        teamSubTitle: {
            id: t('insights.topReactions.subTitle'),
            defaultMessage: 'The team\'s most-used reactions',
        },
        mySubTitle: {
            id: t('insights.topReactions.mySubTitle'),
            defaultMessage: 'Reactions I\'ve used the most',
        },
    },
    TOP_THREADS: {
        teamTitle: {
            id: t('insights.topThreads.title'),
            defaultMessage: 'Top threads',
        },
        myTitle: {
            id: t('insights.topThreads.myTitle'),
            defaultMessage: 'My top threads',
        },
        teamSubTitle: {
            id: t('insights.topThreads.subTitle'),
            defaultMessage: 'Most active threads for the team',
        },
        mySubTitle: {
            id: t('insights.topThreads.mySubTitle'),
            defaultMessage: 'Most active threads I\'ve followed',
        },
    },
    TOP_BOARDS: {
        teamTitle: {
            id: t('insights.topBoards.title'),
            defaultMessage: 'Top boards',
        },
        myTitle: {
            id: t('insights.topBoards.myTitle'),
            defaultMessage: 'My top boards',
        },
        teamSubTitle: {
            id: t('insights.topBoards.subTitle'),
            defaultMessage: 'Most active boards for the team',
        },
        mySubTitle: {
            id: t('insights.topBoards.mySubTitle'),
            defaultMessage: 'Most active boards I\'ve participated in',
        },
    },
    LEAST_ACTIVE_CHANNELS: {
        teamTitle: {
            id: t('insights.leastActiveChannels.title'),
            defaultMessage: 'Least active channels',
        },
        myTitle: {
            id: t('insights.leastActiveChannels.myTitle'),
            defaultMessage: 'My least active channels',
        },
        teamSubTitle: {
            id: t('insights.leastActiveChannels.subTitle'),
            defaultMessage: 'Channels with the least posts',
        },
        mySubTitle: {
            id: t('insights.leastActiveChannels.mySubTitle'),
            defaultMessage: 'My channels with the least posts',
        },
    },
    TOP_PLAYBOOKS: {
        teamTitle: {
            id: t('insights.topPlaybooks.title'),
            defaultMessage: 'Top playbooks',
        },
        myTitle: {
            id: t('insights.topPlaybooks.myTitle'),
            defaultMessage: 'My top playbooks',
        },
        teamSubTitle: {
            id: t('insights.topPlaybooks.subTitle'),
            defaultMessage: 'Playbooks with the most runs',
        },
        mySubTitle: {
            id: t('insights.topPlaybooks.mySubTitle'),
            defaultMessage: 'Playbooks I\'ve used with the most runs',
        },
    },
    TOP_DMS: {
        teamTitle: {},
        myTitle: {
            id: t('insights.topDMs.myTitle'),
            defaultMessage: 'My most active direct messages',
        },
        teamSubTitle: {},
        mySubTitle: {},
    },
    NEW_TEAM_MEMBERS: {
        teamTitle: {
            id: t('insights.newTeamMembers.title'),
            defaultMessage: 'New team members',
        },
        myTitle: {},
        teamSubTitle: {},
        mySubTitle: {},
    },
};

export enum ClaimErrors {
    MFA_VALIDATE_TOKEN_AUTHENTICATE = 'mfa.validate_token.authenticate.app_error',
    ENT_LDAP_LOGIN_USER_NOT_REGISTERED = 'ent.ldap.do_login.user_not_registered.app_error',
    ENT_LDAP_LOGIN_USER_FILTERED = 'ent.ldap.do_login.user_filtered.app_error',
    ENT_LDAP_LOGIN_MATCHED_TOO_MANY_USERS = 'ent.ldap.do_login.matched_to_many_users.app_error',
    ENT_LDAP_LOGIN_INVALID_PASSWORD = 'ent.ldap.do_login.invalid_password.app_error',
    API_USER_INVALID_PASSWORD = 'api.user.check_user_password.invalid.app_error',
}

export const DataSearchTypes = {
    FILES_SEARCH_TYPE: 'files',
    MESSAGES_SEARCH_TYPE: 'messages',
};

export const OverActiveUserLimits = {
    MIN: 0.05,
    MAX: 0.1,
} as const;

export default Constants;
