// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ColorContrastChecker from 'color-contrast-checker';

import {cachedUserNameColors, generateColor} from './utils';

const CONSTRAST_CHECKER = new ColorContrastChecker();
const BACKGROUND_COLOR = '#ACC8E5';

describe('components/user_profile/utils', () => {
    test.each([
        ['Ross_Bednar', '#432dd2', 4.5],
        ['Geovany95', '#2d3086', 4.5],
        ['Madisen25', '#52783a', 2.9],
        ['Gerard17', '#783a54', 4.5],
        ['Alia30', '#392d86', 4.5],
        ['Darien.Prosacco97', '#862d6d', 4.5],
        ['Alf48', '#4053bf', 3.7],
        ['Darron_Orn-Walsh49', '#742d86', 4.5],
    ])('should generate best color contrast', (userName, expected, ratio) => {
        cachedUserNameColors.clear();

        const actual = generateColor(userName, BACKGROUND_COLOR);
        expect(actual).toBe(expected);
        expect(
            CONSTRAST_CHECKER.isLevelCustom(actual, BACKGROUND_COLOR, ratio),
        ).toBeTruthy();
    });
});
