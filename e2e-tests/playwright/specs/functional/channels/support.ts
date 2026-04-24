// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Category / preference name constants for the /mobile-logs slash command
 * attach_app_logs user preference.
 */
export const ATTACH_LOGS_PREFERENCE_CATEGORY = 'advanced_settings';
export const ATTACH_LOGS_PREFERENCE_NAME = 'attach_app_logs';

/**
 * Minimal shape of a user client needed to read user preferences.
 */
type UserPreferencesClient = {
    getUserPreferences: (userId: string) => Promise<Array<{category: string; name: string; value: string}>>;
};

/**
 * Minimal shape of a user client needed to save user preferences.
 */
type SavePreferencesClient = {
    savePreferences: (
        userId: string,
        prefs: Array<{user_id: string; category: string; name: string; value: string}>,
    ) => Promise<unknown>;
};

/**
 * Helper to find the attach_app_logs preference for a given user.
 *
 * Used to verify that /mobile-logs on|off commands actually persisted the
 * preference for the target user.
 */
export async function getAttachLogsPreference(userClient: UserPreferencesClient, userId: string) {
    const prefs = await userClient.getUserPreferences(userId);
    return prefs.find(
        (p: {category: string; name: string}) =>
            p.category === ATTACH_LOGS_PREFERENCE_CATEGORY && p.name === ATTACH_LOGS_PREFERENCE_NAME,
    );
}

/**
 * Helper to pre-set the attach_app_logs preference for a user via the API.
 *
 * Used by tests that want to exercise `/mobile-logs off` or `/mobile-logs status`
 * from a known-enabled starting state without going through another slash command.
 */
export async function setAttachLogsPreference(client: SavePreferencesClient, userId: string, value: 'true' | 'false') {
    await client.savePreferences(userId, [
        {
            user_id: userId,
            category: ATTACH_LOGS_PREFERENCE_CATEGORY,
            name: ATTACH_LOGS_PREFERENCE_NAME,
            value,
        },
    ]);
}
