// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

export const WYSIWYG_PREF_CATEGORY = 'display_settings';
export const WYSIWYG_PREF_NAME = 'wysiwyg_editor';

export async function setWysiwygUserPreference(client: Client4, userId: string, enabled: boolean): Promise<void> {
    await client.savePreferences(userId, [
        {
            user_id: userId,
            category: WYSIWYG_PREF_CATEGORY,
            name: WYSIWYG_PREF_NAME,
            value: enabled ? 'true' : 'false',
        },
    ]);
}
