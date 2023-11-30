// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPluginPreferenceKey} from './preferences';

describe('getPluginPreferenceKey', () => {
    it('Does not go over 32 characters', () => {
        const key = getPluginPreferenceKey('1234567890abcdefghjklmnopqrstuvwxyz');
        expect(key).toHaveLength(32);
    });
});
