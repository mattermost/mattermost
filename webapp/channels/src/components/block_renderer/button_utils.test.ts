// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {mmBlocksButtonClassName, mmBlocksButtonInlineStyle} from './button_utils';

const theme = {
    errorTextColor: '#d24b4e',
    centerChannelColor: '#3f4350',
    buttonBg: '#145dbf',
    onlineIndicator: '#06d6a0',
} as Theme;

describe('mmBlocksButtonClassName', () => {
    it('returns default tertiary classes when style is omitted', () => {
        expect(mmBlocksButtonClassName(undefined)).toBe('btn btn-sm btn-tertiary');
    });

    it('returns primary classes for primary style', () => {
        expect(mmBlocksButtonClassName('primary')).toBe('btn btn-sm btn-primary');
    });

    it('returns danger tertiary classes for danger style', () => {
        expect(mmBlocksButtonClassName('danger')).toBe('btn btn-sm btn-tertiary btn-danger');
    });

    it('returns default tertiary classes for default style', () => {
        expect(mmBlocksButtonClassName('default')).toBe('btn btn-sm btn-tertiary');
    });

    it('returns good classes for good and success styles', () => {
        expect(mmBlocksButtonClassName('good')).toBe('btn btn-sm btn-tertiary mm-blocks-button--good');
        expect(mmBlocksButtonClassName('success')).toBe('btn btn-sm btn-tertiary mm-blocks-button--success');
    });

    it('returns warning classes for warning style', () => {
        expect(mmBlocksButtonClassName('warning')).toBe('btn btn-sm btn-tertiary mm-blocks-button--warning');
    });
});

describe('mmBlocksButtonInlineStyle', () => {
    it('returns undefined for semantic styles', () => {
        expect(mmBlocksButtonInlineStyle('primary', theme)).toBeUndefined();
        expect(mmBlocksButtonInlineStyle('good', theme)).toBeUndefined();
    });

    it('returns tinted background for hex colors', () => {
        const style = mmBlocksButtonInlineStyle('#28a745', theme);
        expect(style?.color).toBe('#28a745');
        expect(style?.backgroundColor).toMatch(/^rgba\(40,? ?167,? ?69,? ?0\.08\)$/);
    });

    it('returns tinted background for theme color keys', () => {
        const style = mmBlocksButtonInlineStyle('onlineIndicator', theme);
        expect(style?.color).toBe(theme.onlineIndicator);
        expect(style?.backgroundColor).toBeDefined();
    });
});
