// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ThemeUtils from 'mattermost-redux/utils/theme_utils';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import {Preferences} from '../constants';

describe('ThemeUtils', () => {
    describe('getComponents', () => {
        it('hex color', () => {
            const input = 'ff77aa';
            const expected = {red: 255, green: 119, blue: 170, alpha: 1};

            expect(ThemeUtils.getComponents(input)).toEqual(expected);
        });

        it('3 digit hex color', () => {
            const input = '4a3';
            const expected = {red: 68, green: 170, blue: 51, alpha: 1};

            expect(ThemeUtils.getComponents(input)).toEqual(expected);
        });

        it('hex color with leading number sign', () => {
            const input = '#cda43d';
            const expected = {red: 205, green: 164, blue: 61, alpha: 1};

            expect(ThemeUtils.getComponents(input)).toEqual(expected);
        });

        it('rgb', () => {
            const input = 'rgb(123,231,67)';
            const expected = {red: 123, green: 231, blue: 67, alpha: 1};

            expect(ThemeUtils.getComponents(input)).toEqual(expected);
        });

        it('rgba', () => {
            const input = 'rgb(45,67,89,0.04)';
            const expected = {red: 45, green: 67, blue: 89, alpha: 0.04};

            expect(ThemeUtils.getComponents(input)).toEqual(expected);
        });
    });

    describe('changeOpacity', () => {
        it('hex color', () => {
            const input = 'ff77aa';
            const expected = 'rgba(255,119,170,0.5)';

            expect(ThemeUtils.changeOpacity(input, 0.5)).toEqual(expected);
        });

        it('rgb', () => {
            const input = 'rgb(123,231,67)';
            const expected = 'rgba(123,231,67,0.3)';

            expect(ThemeUtils.changeOpacity(input, 0.3)).toEqual(expected);
        });

        it('rgba', () => {
            const input = 'rgb(45,67,89,0.4)';
            const expected = 'rgba(45,67,89,0.2)';

            expect(ThemeUtils.changeOpacity(input, 0.5)).toEqual(expected);
        });
    });

    describe('setThemeDefaults', () => {
        it('blank theme', () => {
            const input = {};
            const expected = {...Preferences.THEMES.denim};
            delete expected.type;

            expect(ThemeUtils.setThemeDefaults(input)).toEqual(expected);
        });

        it('correctly updates the sidebarTeamBarBg variable', () => {
            const input = {sidebarHeaderBg: '#ffaa55'};

            expect(ThemeUtils.setThemeDefaults(input).sidebarTeamBarBg).toEqual('#cc8844');
        });

        it('set defaults on unset properties only', () => {
            const input = {buttonColor: '#7600ff'};
            expect(ThemeUtils.setThemeDefaults(input).buttonColor).toEqual('#7600ff');
        });

        it('ignore type', () => {
            const input = {type: 'sometype' as any};
            expect(ThemeUtils.setThemeDefaults(input).type).toEqual('sometype');
        });
    });
});

describe('getContrastingSimpleColor', () => {
    // Test for dark colors that should return white text
    it('should return white (#FFFFFF) for black', () => {
        expect(getContrastingSimpleColor('#000000')).toBe('#FFFFFF');
    });

    it('should return white for dark blue', () => {
        expect(getContrastingSimpleColor('#0000FF')).toBe('#FFFFFF');
    });

    it('should return white for dark red', () => {
        expect(getContrastingSimpleColor('#8B0000')).toBe('#FFFFFF');
    });

    it('should return white for dark green', () => {
        expect(getContrastingSimpleColor('#006400')).toBe('#FFFFFF');
    });

    // Test for light colors that should return black text
    it('should return black (#000000) for white', () => {
        expect(getContrastingSimpleColor('#FFFFFF')).toBe('#000000');
    });

    it('should return black for light yellow', () => {
        expect(getContrastingSimpleColor('#FFFF00')).toBe('#000000');
    });

    it('should return black for light cyan', () => {
        expect(getContrastingSimpleColor('#00FFFF')).toBe('#000000');
    });

    it('should return black for light pink', () => {
        expect(getContrastingSimpleColor('#FFC0CB')).toBe('#000000');
    });

    it('should not crash for invalid colors', () => {
        expect(getContrastingSimpleColor('')).toBe('');
        expect(getContrastingSimpleColor('##########')).toBe('');
        expect(getContrastingSimpleColor('    ')).toBe('');
    });

    // Test for colors near the threshold
    it('should return black for colors just above the luminance threshold', () => {
        // for this background color, black text has a
        // contrast ratio of 4.4:1, whereas white has that of 4.6:1,
        // giving it a slight advantage.
        expect(getContrastingSimpleColor('#747474')).toBe('#FFFFFF');
    });

    it('should return white for colors just below the luminance threshold', () => {
        // #737373 has a luminance of approximately 0.178 (just below threshold)
        expect(getContrastingSimpleColor('#737373')).toBe('#FFFFFF');
    });

    // Test for input format variations
    it('should handle hex colors with or without # prefix', () => {
        expect(getContrastingSimpleColor('000000')).toBe('#FFFFFF');
        expect(getContrastingSimpleColor('#000000')).toBe('#FFFFFF');
        expect(getContrastingSimpleColor('FFFFFF')).toBe('#000000');
        expect(getContrastingSimpleColor('#FFFFFF')).toBe('#000000');
    });

    // Test for more realistic use cases
    it('should return appropriate contrast colors for common UI colors', () => {
        // Mattermost denim blue
        expect(getContrastingSimpleColor('#1e325c')).toBe('#FFFFFF');

        // Mattermost Onyx grey
        expect(getContrastingSimpleColor('#202228')).toBe('#FFFFFF');

        // Mattermost Indigo blue
        expect(getContrastingSimpleColor('#151e32')).toBe('#FFFFFF');

        // Mattermost quartz white
        expect(getContrastingSimpleColor('#f4f4f6')).toBe('#000000');
    });
});
