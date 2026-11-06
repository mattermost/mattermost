// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {entityLabel} from './labels';

const intl = createIntl({locale: 'en', messages: {}});

describe('entityLabel', () => {
    it('returns the display name for known core types', () => {
        expect(entityLabel('mm.time', intl.formatMessage)).toBe('Time');
        expect(entityLabel('mm.vuln', intl.formatMessage)).toBe('Vulnerability');
    });

    it('falls back to the type id when no label is registered', () => {
        expect(entityLabel('com.example.custom', intl.formatMessage)).toBe('com.example.custom');
    });
});
