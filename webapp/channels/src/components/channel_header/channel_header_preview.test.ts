// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CHANNEL_HEADER_PREVIEW_MAX_LENGTH, previewChannelHeaderText} from './channel_header_preview';

describe('previewChannelHeaderText', () => {
    test('returns short text unchanged', () => {
        expect(previewChannelHeaderText('Hello')).toBe('Hello');
    });

    test('documents preview max length constant', () => {
        expect(CHANNEL_HEADER_PREVIEW_MAX_LENGTH).toBe(120);
    });
});
