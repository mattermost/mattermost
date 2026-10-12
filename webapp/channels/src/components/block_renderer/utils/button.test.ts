// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {
    isMmButtonHexColor,
    isMmButtonSemanticStyle,
    mmBlocksButtonClassName,
    mmBlocksButtonInlineStyle,
    parseMmButtonStyle,
} from './button';

const theme = {
    errorTextColor: '#d24b4e',
    centerChannelColor: '#3f4350',
    buttonBg: '#145dbf',
    onlineIndicator: '#06d6a0',
} as Theme;

describe('parseMmButtonStyle', () => {
    it('returns undefined when style is omitted', () => {
        expect(parseMmButtonStyle(undefined)).toBeUndefined();
    });

    it('preserves semantic attachment styles', () => {
        expect(parseMmButtonStyle('good')).toBe('good');
        expect(parseMmButtonStyle('success')).toBe('success');
        expect(parseMmButtonStyle('warning')).toBe('warning');
        expect(parseMmButtonStyle('primary')).toBe('primary');
        expect(parseMmButtonStyle('danger')).toBe('danger');
        expect(parseMmButtonStyle('default')).toBe('default');
    });

    it('preserves hex colors', () => {
        expect(parseMmButtonStyle('#2d81ff')).toBe('#2d81ff');
        expect(parseMmButtonStyle('#abc')).toBe('#abc');
    });

    it('returns undefined for invalid values', () => {
        expect(parseMmButtonStyle('onlineIndicator')).toBeUndefined();
        expect(parseMmButtonStyle('#wrong')).toBeUndefined();
    });
});

describe('isMmButtonSemanticStyle', () => {
    it('identifies semantic styles only', () => {
        expect(isMmButtonSemanticStyle('warning')).toBe(true);
        expect(isMmButtonSemanticStyle('#28a745')).toBe(false);
    });
});

describe('isMmButtonHexColor', () => {
    it('identifies hex colors only', () => {
        expect(isMmButtonHexColor('#28a745')).toBe(true);
        expect(isMmButtonHexColor('good')).toBe(false);
    });
});

describe('mmBlocksButtonClassName', () => {
    it('returns base class when style is omitted, primary, danger, or default', () => {
        expect(mmBlocksButtonClassName(undefined)).toBe('mm-blocks-button');
        expect(mmBlocksButtonClassName('primary')).toBe('mm-blocks-button');
        expect(mmBlocksButtonClassName('danger')).toBe('mm-blocks-button');
        expect(mmBlocksButtonClassName('default')).toBe('mm-blocks-button');
    });

    it('returns good classes for good and success styles', () => {
        expect(mmBlocksButtonClassName('good')).toBe('mm-blocks-button mm-blocks-button--good');
        expect(mmBlocksButtonClassName('success')).toBe('mm-blocks-button mm-blocks-button--success');
    });

    it('returns warning classes for warning style', () => {
        expect(mmBlocksButtonClassName('warning')).toBe('mm-blocks-button mm-blocks-button--warning');
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
        expect(style?.['--button-fg']).toBe('#28a745');
        expect(style?.backgroundColor).toMatch(/^rgba\(40,? ?167,? ?69,? ?0\.08\)$/);
    });

    it('returns tinted background for theme color keys', () => {
        const style = mmBlocksButtonInlineStyle('onlineIndicator', theme);
        expect(style?.color).toBe(theme.onlineIndicator);
        expect(style?.['--button-fg']).toBe(theme.onlineIndicator);
        expect(style?.backgroundColor).toBeDefined();
    });
});
