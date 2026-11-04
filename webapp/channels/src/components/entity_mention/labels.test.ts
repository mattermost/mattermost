// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {entityLabel} from './labels';

describe('entityLabel', () => {
    it('returns the display name for known core types', () => {
        expect(entityLabel('mm.time')).toBe('Time');
        expect(entityLabel('mm.vuln')).toBe('Vulnerability');
    });

    it('falls back to the type id when no label is registered', () => {
        expect(entityLabel('com.example.custom')).toBe('com.example.custom');
    });
});
