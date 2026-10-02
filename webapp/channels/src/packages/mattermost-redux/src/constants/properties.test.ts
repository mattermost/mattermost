// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from './properties';

describe('PROPERTY_TEXT_VALUE_MAX_LENGTH', () => {
    test('matches the server\'s PropertyFieldValueTypeTextMaxLength (server/public/model/property_field_attrs_validation.go)', () => {
        // Kept in sync by hand -- there is no cross-language check, so this pins
        // the value the comment on the constant promises. If this fails, update
        // whichever side did not change.
        expect(PROPERTY_TEXT_VALUE_MAX_LENGTH).toBe(64);
    });
});
