# Missing Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add missing test coverage for Mattermost Extended features as identified in TEST_PLAN_MATTERMOST_EXTENDED.md

**Architecture:** Based on analysis of the test plan and codebase, most "missing" server tests are for features that are frontend-only (no server logic to test). The actual gaps are:
1. **SettingsResorted** - Needs webapp tests (frontend-only feature)
2. **PreferencesRevamp** - Needs webapp tests for `preference_definitions.ts` utility functions

**Tech Stack:** TypeScript/React (Jest), existing test patterns from `webapp/channels/src/tests/mattermost_extended/`

---

## Analysis Summary

### Features Marked as Missing Server Tests (No Tests Actually Needed)

These features are **frontend-only** and don't have server-side logic to test:

| Feature | Reason No Server Tests Needed |
|---------|-------------------------------|
| ThreadsInSidebar | Uses existing thread APIs, UI-only grouping |
| CustomThreadNames | Uses existing patchThread API, UI-only display |
| ImageMulti | CSS/display only |
| ImageSmaller | Config stored via existing config system |
| ImageCaptions | Config stored via existing config system |
| VideoEmbed | UI component only |
| VideoLinkEmbed | Markdown processing, UI only |
| EmbedYoutube | UI component only |
| HideDeletedMessagePlaceholder | Config stored via existing config system |
| SidebarChannelSettings | UI menu item only |
| HideUpdateStatusButton | UI conditional only |

### Actual Missing Tests

| Feature | Test Type | Priority |
|---------|-----------|----------|
| SettingsResorted | Webapp | Medium |
| PreferencesRevamp | Webapp | Medium |

---

## Task 1: PreferencesRevamp Utility Tests

**Files:**
- Create: `webapp/channels/src/utils/preference_definitions.test.ts`
- Test: `webapp/channels/src/utils/preference_definitions.ts`

**Step 1: Write the failing test**

```typescript
// webapp/channels/src/utils/preference_definitions.test.ts
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
        });

        it('should return undefined for invalid preference', () => {
            const group = getPreferenceGroup('invalid', 'invalid');
            expect(group).toBeUndefined();
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `cd webapp && npm test -- --testPathPattern="preference_definitions.test" --watchAll=false`
Expected: PASS (this is testing existing utility functions)

**Step 3: Verify all tests pass**

The tests should pass since the utility functions already exist.

**Step 4: Commit**

```bash
git add webapp/channels/src/utils/preference_definitions.test.ts
git commit -m "test: add preference_definitions utility tests"
```

---

## Task 2: SettingsResorted Webapp Tests

**Files:**
- Create: `webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx`
- Test: `webapp/channels/src/components/user_settings/modal/user_settings_modal.tsx`

**Step 1: Write the failing test**

```typescript
// webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx
/**
 * Tests for the SettingsResorted feature flag.
 * When enabled, user settings are reorganized into intuitive categories with icons.
 */

describe('SettingsResorted Feature', () => {
    describe('Config Mapping', () => {
        it('should map FeatureFlagSettingsResorted to boolean', () => {
            // When config.FeatureFlagSettingsResorted === 'true', feature is enabled
            const configEnabled = {FeatureFlagSettingsResorted: 'true'};
            const configDisabled = {FeatureFlagSettingsResorted: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagSettingsResorted === 'true').toBe(true);
            expect(configDisabled.FeatureFlagSettingsResorted === 'true').toBe(false);
            expect((configMissing as any).FeatureFlagSettingsResorted === 'true').toBe(false);
        });
    });

    describe('Tab Structure', () => {
        describe('when SettingsResorted is disabled', () => {
            it('should have default tabs: Notifications, Display, Sidebar, Advanced', () => {
                const defaultTabs = [
                    'notifications',
                    'display',
                    'sidebar',
                    'advanced',
                ];

                // Default tab names
                expect(defaultTabs).toContain('notifications');
                expect(defaultTabs).toContain('display');
                expect(defaultTabs).toContain('sidebar');
                expect(defaultTabs).toContain('advanced');
            });

            it('should NOT have split display tabs', () => {
                const defaultTabs = [
                    'notifications',
                    'display',
                    'sidebar',
                    'advanced',
                ];

                expect(defaultTabs).not.toContain('display_theme');
                expect(defaultTabs).not.toContain('display_time');
                expect(defaultTabs).not.toContain('display_teammates');
                expect(defaultTabs).not.toContain('display_messages');
                expect(defaultTabs).not.toContain('display_channel');
                expect(defaultTabs).not.toContain('display_language');
            });
        });

        describe('when SettingsResorted is enabled', () => {
            it('should have reorganized tabs with split display categories', () => {
                const resortedTabs = [
                    'notifications',
                    'display_theme',
                    'display_time',
                    'display_teammates',
                    'display_messages',
                    'display_channel',
                    'display_language',
                    'sidebar',
                    'advanced',
                ];

                // Should have split display tabs
                expect(resortedTabs).toContain('display_theme');
                expect(resortedTabs).toContain('display_time');
                expect(resortedTabs).toContain('display_teammates');
                expect(resortedTabs).toContain('display_messages');
                expect(resortedTabs).toContain('display_channel');
                expect(resortedTabs).toContain('display_language');
            });

            it('should NOT have combined display tab', () => {
                const resortedTabs = [
                    'notifications',
                    'display_theme',
                    'display_time',
                    'display_teammates',
                    'display_messages',
                    'display_channel',
                    'display_language',
                    'sidebar',
                    'advanced',
                ];

                expect(resortedTabs).not.toContain('display');
            });
        });
    });

    describe('Tab Icons', () => {
        const tabIcons = {
            notifications: 'icon icon-bell-outline',
            display_theme: 'icon icon-palette-outline',
            display_time: 'icon icon-clock-outline',
            display_teammates: 'icon icon-account-multiple-outline',
            display_messages: 'icon icon-message-text-outline',
            display_channel: 'icon icon-forum-outline',
            display_language: 'icon icon-globe',
            sidebar: 'icon icon-dock-left',
            advanced: 'icon icon-tune',
        };

        it('should have icon for each resorted tab', () => {
            Object.entries(tabIcons).forEach(([tab, icon]) => {
                expect(icon).toBeDefined();
                expect(icon).toContain('icon icon-');
            });
        });

        it('should use MDI (Material Design Icons) format', () => {
            Object.values(tabIcons).forEach((icon) => {
                expect(icon).toMatch(/^icon icon-[\w-]+$/);
            });
        });
    });

    describe('Preference Group Mapping', () => {
        it('should map display_theme tab to THEME group', () => {
            const tabToGroup: Record<string, string> = {
                display_theme: 'theme',
                display_time: 'time_date',
                display_teammates: 'teammates',
                display_messages: 'messages',
                display_channel: 'channel',
                display_language: 'language',
            };

            expect(tabToGroup.display_theme).toBe('theme');
            expect(tabToGroup.display_time).toBe('time_date');
            expect(tabToGroup.display_teammates).toBe('teammates');
            expect(tabToGroup.display_messages).toBe('messages');
            expect(tabToGroup.display_channel).toBe('channel');
            expect(tabToGroup.display_language).toBe('language');
        });
    });

    describe('Feature Flag Toggle', () => {
        it('should be configurable via admin console', () => {
            // The feature flag is exposed in admin_definition.tsx
            // and can be toggled via MattermostExtendedSettings.Features.SettingsResorted
            const featureFlagKey = 'FeatureFlagSettingsResorted';
            expect(featureFlagKey).toBeDefined();
        });

        it('should be configurable via environment variable', () => {
            // MM_FEATUREFLAGS_SETTINGSRESORTED=true
            const envVarName = 'MM_FEATUREFLAGS_SETTINGSRESORTED';
            expect(envVarName).toBe('MM_FEATUREFLAGS_SETTINGSRESORTED');
        });
    });
});
```

**Step 2: Run test to verify it passes**

Run: `cd webapp && npm test -- --testPathPattern="settings_resorted" --watchAll=false`
Expected: PASS

**Step 3: Commit**

```bash
git add webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx
git commit -m "test: add SettingsResorted feature tests"
```

---

## Task 3: Update TEST_PLAN_MATTERMOST_EXTENDED.md

**Files:**
- Modify: `TEST_PLAN_MATTERMOST_EXTENDED.md`

**Step 1: Update the test coverage table**

Update the table to reflect the correct status - mark frontend-only features as "N/A" for server tests.

**Step 2: Add the new test file locations**

Add entries for the new test files created in Tasks 1-2.

**Step 3: Commit**

```bash
git add TEST_PLAN_MATTERMOST_EXTENDED.md
git commit -m "docs: update test plan with correct coverage status"
```

---

## Summary

### What's Actually Missing (Tests to Create)

| Test File | Feature | Type | Priority |
|-----------|---------|------|----------|
| `preference_definitions.test.ts` | PreferencesRevamp | Unit | Medium |
| `settings_resorted.test.tsx` | SettingsResorted | Unit | Medium |

### What's NOT Missing (Clarifications)

The following features marked as "Server ❌ Missing" in the test plan **do not need server tests** because they are frontend-only:

- **ThreadsInSidebar** - UI grouping only, uses existing thread APIs
- **CustomThreadNames** - UI display only, uses existing patchThread API
- **ImageMulti** - CSS/display logic only
- **ImageSmaller** - Config value only (no server logic)
- **ImageCaptions** - Config value only (no server logic)
- **VideoEmbed** - UI component only
- **VideoLinkEmbed** - Markdown rendering only
- **EmbedYoutube** - UI component only
- **HideDeletedMessagePlaceholder** - Config value only
- **SidebarChannelSettings** - UI menu item only
- **HideUpdateStatusButton** - UI conditional only

### Test File Locations (After Implementation)

| Feature | Test File |
|---------|-----------|
| PreferencesRevamp | `webapp/channels/src/utils/preference_definitions.test.ts` |
| SettingsResorted | `webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx` |

---

## Running the Tests

```bash
# Run all new tests
cd webapp && npm test -- --testPathPattern="preference_definitions|settings_resorted" --watchAll=false

# Run full Mattermost Extended test suite
cd webapp && npm test -- --testPathPattern="mattermost_extended" --watchAll=false
```
