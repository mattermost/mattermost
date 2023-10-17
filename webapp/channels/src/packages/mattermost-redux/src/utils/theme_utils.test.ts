// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ThemeUtils from 'mattermost-redux/utils/theme_utils';

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
