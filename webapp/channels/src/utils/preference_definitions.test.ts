// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PREFERENCE_DEFINITIONS,
    PreferenceGroups,
    PREFERENCE_GROUP_INFO,
    PreferenceNames,
    getPreferenceDefinition,
    getPreferenceDefinitionsByCategory,
    hasPreferenceDefinition,
    getPreferenceDefinitionsGrouped,
    getPreferenceGroup,
} from './preference_definitions';

describe('preference_definitions', () => {
    describe('PREFERENCE_DEFINITIONS', () => {
        it('should have all expected preference keys', () => {
            const expectedKeys = [
                'display_settings:use_military_time',
                'display_settings:channel_display_mode',
                'display_settings:message_display',
                'display_settings:collapse_previews',
                'display_settings:link_preview_display',
                'display_settings:colorize_usernames',
                'display_settings:name_format',
                'display_settings:availability_status_on_posts',
                'display_settings:collapsed_reply_threads',
                'display_settings:click_to_reply',
                'display_settings:one_click_reactions_enabled',
                'display_settings:always_show_remote_user_hour',
                'display_settings:render_emoticons_as_emoji',
                'display_settings:guilded_chat_layout',
                'notifications:email_interval',
                'advanced_settings:formatting',
                'advanced_settings:send_on_ctrl_enter',
                'advanced_settings:code_block_ctrl_enter',
                'advanced_settings:join_leave',
                'advanced_settings:sync_drafts',
                'advanced_settings:unread_scroll_position',
                'sidebar_settings:show_unread_section',
                'sidebar_settings:limit_visible_dms_gms',
            ];

            expectedKeys.forEach((key) => {
                expect(PREFERENCE_DEFINITIONS[key]).toBeDefined();
            });
        });

        it('should have valid structure for each definition', () => {
            Object.entries(PREFERENCE_DEFINITIONS).forEach(([key, def]) => {
                expect(def.category).toBeDefined();
                expect(def.name).toBeDefined();
                expect(def.title).toBeDefined();
                expect(def.description).toBeDefined();
                expect(def.options).toBeInstanceOf(Array);
                expect(def.options.length).toBeGreaterThanOrEqual(2);
                expect(def.defaultValue).toBeDefined();
                expect(def.group).toBeDefined();
                expect(typeof def.order).toBe('number');

                // Verify key format matches category:name
                expect(key).toBe(`${def.category}:${def.name}`);
            });
        });

        it('should have valid options for each definition', () => {
            Object.values(PREFERENCE_DEFINITIONS).forEach((def) => {
                def.options.forEach((opt) => {
                    expect(opt.value).toBeDefined();
                    expect(opt.label).toBeDefined();
                });

                // Default value should be one of the options
                const optionValues = def.options.map((o) => o.value);
                expect(optionValues).toContain(def.defaultValue);
            });
        });
    });

    describe('PreferenceGroups', () => {
        it('should have all expected groups', () => {
            expect(PreferenceGroups.THEME).toBe('theme');
            expect(PreferenceGroups.TIME_DATE).toBe('time_date');
            expect(PreferenceGroups.TEAMMATES).toBe('teammates');
            expect(PreferenceGroups.MESSAGES).toBe('messages');
            expect(PreferenceGroups.CHANNEL).toBe('channel');
            expect(PreferenceGroups.LANGUAGE).toBe('language');
            expect(PreferenceGroups.NOTIFICATIONS).toBe('notifications');
            expect(PreferenceGroups.ADVANCED).toBe('advanced');
            expect(PreferenceGroups.SIDEBAR).toBe('sidebar');
        });
    });

    describe('PREFERENCE_GROUP_INFO', () => {
        it('should have info for all groups', () => {
            Object.values(PreferenceGroups).forEach((group) => {
                expect(PREFERENCE_GROUP_INFO[group]).toBeDefined();
                expect(PREFERENCE_GROUP_INFO[group].title).toBeDefined();
                expect(typeof PREFERENCE_GROUP_INFO[group].order).toBe('number');
            });
        });

        it('should have unique order values', () => {
            const orders = Object.values(PREFERENCE_GROUP_INFO).map((info) => info.order);
            const uniqueOrders = new Set(orders);
            expect(uniqueOrders.size).toBe(orders.length);
        });
    });

    describe('PreferenceNames', () => {
        it('should have all display settings names', () => {
            expect(PreferenceNames.USE_MILITARY_TIME).toBe('use_military_time');
            expect(PreferenceNames.CHANNEL_DISPLAY_MODE).toBe('channel_display_mode');
            expect(PreferenceNames.MESSAGE_DISPLAY).toBe('message_display');
            expect(PreferenceNames.COLLAPSE_DISPLAY).toBe('collapse_previews');
            expect(PreferenceNames.LINK_PREVIEW_DISPLAY).toBe('link_preview_display');
            expect(PreferenceNames.COLORIZE_USERNAMES).toBe('colorize_usernames');
            expect(PreferenceNames.NAME_FORMAT).toBe('name_format');
            expect(PreferenceNames.GUILDED_CHAT_LAYOUT).toBe('guilded_chat_layout');
        });

        it('should have all notification and advanced settings names', () => {
            expect(PreferenceNames.EMAIL_INTERVAL).toBe('email_interval');
            expect(PreferenceNames.FORMATTING).toBe('formatting');
            expect(PreferenceNames.SEND_ON_CTRL_ENTER).toBe('send_on_ctrl_enter');
            expect(PreferenceNames.SYNC_DRAFTS).toBe('sync_drafts');
        });

        it('should have all sidebar settings names', () => {
            expect(PreferenceNames.SHOW_UNREAD_SECTION).toBe('show_unread_section');
            expect(PreferenceNames.LIMIT_VISIBLE_DMS_GMS).toBe('limit_visible_dms_gms');
        });
    });

    describe('getPreferenceDefinition', () => {
        it('should return definition for valid category and name', () => {
            const def = getPreferenceDefinition('display_settings', 'use_military_time');
            expect(def).toBeDefined();
            expect(def?.category).toBe('display_settings');
            expect(def?.name).toBe('use_military_time');
        });

        it('should return undefined for invalid category', () => {
            const def = getPreferenceDefinition('invalid_category', 'use_military_time');
            expect(def).toBeUndefined();
        });

        it('should return undefined for invalid name', () => {
            const def = getPreferenceDefinition('display_settings', 'invalid_name');
            expect(def).toBeUndefined();
        });
    });

    describe('getPreferenceDefinitionsByCategory', () => {
        it('should return all definitions for display_settings', () => {
            const defs = getPreferenceDefinitionsByCategory('display_settings');
            expect(defs.length).toBeGreaterThan(0);
            defs.forEach((def) => {
                expect(def.category).toBe('display_settings');
            });
        });

        it('should return all definitions for advanced_settings', () => {
            const defs = getPreferenceDefinitionsByCategory('advanced_settings');
            expect(defs.length).toBeGreaterThan(0);
            defs.forEach((def) => {
                expect(def.category).toBe('advanced_settings');
            });
        });

        it('should return empty array for invalid category', () => {
            const defs = getPreferenceDefinitionsByCategory('invalid_category');
            expect(defs).toEqual([]);
        });
    });

    describe('hasPreferenceDefinition', () => {
        it('should return true for valid preference', () => {
            expect(hasPreferenceDefinition('display_settings', 'use_military_time')).toBe(true);
        });

        it('should return false for invalid preference', () => {
            expect(hasPreferenceDefinition('invalid', 'invalid')).toBe(false);
        });
    });

    describe('getPreferenceDefinitionsGrouped', () => {
        it('should return all groups', () => {
            const grouped = getPreferenceDefinitionsGrouped();
            expect(grouped.length).toBeGreaterThan(0);
        });

        it('should sort groups by order', () => {
            const grouped = getPreferenceDefinitionsGrouped();
            for (let i = 1; i < grouped.length; i++) {
                expect(grouped[i].groupInfo.order).toBeGreaterThan(grouped[i - 1].groupInfo.order);
            }
        });

        it('should sort preferences within groups by order', () => {
            const grouped = getPreferenceDefinitionsGrouped();
            grouped.forEach((group) => {
                for (let i = 1; i < group.preferences.length; i++) {
                    expect(group.preferences[i].order).toBeGreaterThanOrEqual(group.preferences[i - 1].order);
                }
            });
        });

        it('should include all preferences', () => {
            const grouped = getPreferenceDefinitionsGrouped();
            const allPrefs = grouped.flatMap((g) => g.preferences);
            expect(allPrefs.length).toBe(Object.keys(PREFERENCE_DEFINITIONS).length);
        });
    });

    describe('getPreferenceGroup', () => {
        it('should return group for valid preference', () => {
            const group = getPreferenceGroup('display_settings', 'use_military_time');
            expect(group).toBe(PreferenceGroups.TIME_DATE);
        });

        it('should return correct group for different preferences', () => {
            expect(getPreferenceGroup('display_settings', 'message_display')).toBe(PreferenceGroups.MESSAGES);
            expect(getPreferenceGroup('display_settings', 'name_format')).toBe(PreferenceGroups.TEAMMATES);
            expect(getPreferenceGroup('notifications', 'email_interval')).toBe(PreferenceGroups.NOTIFICATIONS);
            expect(getPreferenceGroup('advanced_settings', 'formatting')).toBe(PreferenceGroups.ADVANCED);
            expect(getPreferenceGroup('sidebar_settings', 'show_unread_section')).toBe(PreferenceGroups.SIDEBAR);
            expect(getPreferenceGroup('display_settings', 'guilded_chat_layout')).toBe(PreferenceGroups.CHANNEL);
        });

        it('should return undefined for invalid preference', () => {
            const group = getPreferenceGroup('invalid', 'invalid');
            expect(group).toBeUndefined();
        });
    });
});
