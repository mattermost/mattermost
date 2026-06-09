// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isMmButtonHexColor, isMmButtonSemanticStyle, parseMmButtonStyle} from './button';

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
