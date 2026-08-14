// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from 'mattermost-redux/constants';

import {isLightTheme} from './theme_utils';

describe('isLightTheme', () => {
    it('treats Denim, Sapphire, and Quartz as light', () => {
        expect(isLightTheme(Preferences.THEMES.denim)).toBe(true);
        expect(isLightTheme(Preferences.THEMES.sapphire)).toBe(true);
        expect(isLightTheme(Preferences.THEMES.quartz)).toBe(true);
    });

    it('treats Indigo and Onyx as dark', () => {
        expect(isLightTheme(Preferences.THEMES.indigo)).toBe(false);
        expect(isLightTheme(Preferences.THEMES.onyx)).toBe(false);
    });

    it('treats missing or invalid colors as light', () => {
        expect(isLightTheme(undefined)).toBe(true);
        expect(isLightTheme({} as never)).toBe(true);
        expect(isLightTheme({centerChannelBg: '#gggggg'} as never)).toBe(true);
    });
});
