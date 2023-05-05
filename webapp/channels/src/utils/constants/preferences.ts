// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const CATEGORY_CHANNEL_OPEN_TIME = 'channel_open_time';
export const CATEGORY_DIRECT_CHANNEL_SHOW = 'direct_channel_show';
export const CATEGORY_GROUP_CHANNEL_SHOW = 'group_channel_show';
export const CATEGORY_DISPLAY_SETTINGS = 'display_settings';
export const CATEGORY_SIDEBAR_SETTINGS = 'sidebar_settings';
export const CATEGORY_ADVANCED_SETTINGS = 'advanced_settings';
export const TUTORIAL_STEP = 'tutorial_step';
export const TUTORIAL_STEP_AUTO_TOUR_STATUS = 'tutorial_step_auto_tour_status';
export const CRT_TUTORIAL_TRIGGERED = 'crt_tutorial_triggered';
export const CRT_TUTORIAL_AUTO_TOUR_STATUS = 'crt_tutorial_auto_tour_status';
export const CRT_TUTORIAL_STEP = 'crt_tutorial_step';
export const EXPLORE_OTHER_TOOLS_TUTORIAL_STEP = 'explore_other_tools_step';
export const CRT_THREAD_PANE_STEP = 'crt_thread_pane_step';
export const CHANNEL_DISPLAY_MODE = 'channel_display_mode';
export const CHANNEL_DISPLAY_MODE_CENTERED = 'centered';
export const CHANNEL_DISPLAY_MODE_FULL_SCREEN = 'full';
export const CHANNEL_DISPLAY_MODE_DEFAULT = 'full';
export const MESSAGE_DISPLAY = 'message_display';
export const MESSAGE_DISPLAY_CLEAN = 'clean';
export const MESSAGE_DISPLAY_COMPACT = 'compact';
export const MESSAGE_DISPLAY_DEFAULT = 'clean';
export const COLORIZE_USERNAMES = 'colorize_usernames';
export const COLORIZE_USERNAMES_DEFAULT = 'true';
export const COLLAPSED_REPLY_THREADS = 'collapsed_reply_threads';
export const COLLAPSED_REPLY_THREADS_OFF = 'off';
export const COLLAPSED_REPLY_THREADS_ON = 'on';
export const CLICK_TO_REPLY = 'click_to_reply';
export const CLICK_TO_REPLY_DEFAULT = 'true';
export const COLLAPSED_REPLY_THREADS_FALLBACK_DEFAULT = 'off';
export const LINK_PREVIEW_DISPLAY = 'link_previews';
export const LINK_PREVIEW_DISPLAY_DEFAULT = 'true';
export const COLLAPSE_DISPLAY = 'collapse_previews';
export const COLLAPSE_DISPLAY_DEFAULT = 'false';
export const AVAILABILITY_STATUS_ON_POSTS = 'availability_status_on_posts';
export const AVAILABILITY_STATUS_ON_POSTS_DEFAULT = 'true';
export const USE_MILITARY_TIME = 'use_military_time';
export const USE_MILITARY_TIME_DEFAULT = 'false';
export const UNREAD_SCROLL_POSITION = 'unread_scroll_position';
export const UNREAD_SCROLL_POSITION_START_FROM_LEFT = 'start_from_left_off';
export const UNREAD_SCROLL_POSITION_START_FROM_NEWEST = 'start_from_newest';
export const CATEGORY_THEME = 'theme';
export const CATEGORY_FLAGGED_POST = 'flagged_post';
export const CATEGORY_NOTIFICATIONS = 'notifications';
export const EMAIL_INTERVAL = 'email_interval';
export const INTERVAL_IMMEDIATE = 30; // "immediate" is a 30 second interval
export const INTERVAL_FIFTEEN_MINUTES = 15 * 60;
export const INTERVAL_HOUR = 60 * 60;
export const INTERVAL_NEVER = 0;
export const NAME_NAME_FORMAT = 'name_format';
export const CATEGORY_SYSTEM_NOTICE = 'system_notice';
export const RECOMMENDED_NEXT_STEPS = 'recommended_next_steps';
export const TEAMS_ORDER = 'teams_order';
export const CLOUD_UPGRADE_BANNER = 'cloud_upgrade_banner';
export const CLOUD_TRIAL_BANNER = 'cloud_trial_banner';
export const START_TRIAL_MODAL = 'start_trial_modal';
export const ADMIN_CLOUD_UPGRADE_PANEL = 'admin_cloud_upgrade_panel';
export const CATEGORY_EMOJI = 'emoji';
export const EMOJI_SKINTONE = 'emoji_skintone';
export const ONE_CLICK_REACTIONS_ENABLED = 'one_click_reactions_enabled';
export const ONE_CLICK_REACTIONS_ENABLED_DEFAULT = 'true';
export const CLOUD_TRIAL_END_BANNER = 'cloud_trial_end_banner';
export const CLOUD_USER_EPHEMERAL_INFO = 'cloud_user_ephemeral_info';
export const CATEGORY_CLOUD_LIMITS = 'cloud_limits';
export const THREE_DAYS_LEFT_TRIAL_MODAL = 'three_days_left_trial_modal';

// For one off things that have a special, attention-grabbing UI until you interact with them
export const TOUCHED = 'touched';

// Category for actions/interactions that will happen just once
export const UNIQUE = 'unique';

// A/B test preference value
export const AB_TEST_PREFERENCE_VALUE = 'ab_test_preference_value';

export const RECENT_EMOJIS = 'recent_emojis';
export const ONBOARDING = 'onboarding';
export const ADVANCED_TEXT_EDITOR = 'advanced_text_editor';

export const FORWARD_POST_VIEWED = 'forward_post_viewed';
export const HIDE_POST_FILE_UPGRADE_WARNING = 'hide_post_file_upgrade_warning';
export const SHOWN_LIMITS_REACHED_ON_LOGIN = 'shown_limits_reached_on_login';
export const USE_CASE = 'use_case';
export const DELINQUENCY_MODAL_CONFIRMED = 'delinquency_modal_confirmed';
export const CONFIGURATION_BANNERS = 'configuration_banners';
export const NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE = 'admin_revoke_downgraded_instance';
export const OVERAGE_USERS_BANNER = 'overage_users_banner';
export const TO_CLOUD_YEARLY_PLAN_NUDGE = 'to_cloud_yearly_plan_nudge';
export const TO_PAID_PLAN_NUDGE = 'to_paid_plan_nudge';
