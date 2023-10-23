// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ColorContrastChecker from 'color-contrast-checker';

import {cachedUserNameColors, generateColor} from './utils';

const CONSTRAST_CHECKER = new ColorContrastChecker();
const BACKGROUND_COLOR = '#ACC8E5';

describe('components/user_profile/utils', () => {
    test.each([
        ['Ross_Bednar', '#ac538a', 2.7],
        ['Geovany95', '#1f9335', 2.2],
        ['Madisen25', '#56862d', 2.5],
        ['Gerard17', '#783a54', 4.5],
        ['Alia30', '#392d86', 4.5],
        ['Darien.Prosacco97', '#862d6d', 4.5],
        ['Alf48', '#5354ac', 3.7],
        ['Darron_Orn-Walsh49', '#3a5878', 4.2],
    ])('should generate best color contrast', (userName, expected, ratio) => {
        cachedUserNameColors.clear();

        const actual = generateColor(userName, BACKGROUND_COLOR);
        expect(actual).toBe(expected);
        expect(
            CONSTRAST_CHECKER.isLevelCustom(actual, BACKGROUND_COLOR, ratio),
        ).toBeTruthy();
    });
});
