// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isValidBotUsername} from 'utils/utils';

import {usernameFromDisplayName} from './username';

describe('usernameFromDisplayName', () => {
    test.each([
        ['', ''],
        ['   ', ''],
        ['Build Bot', 'build-bot'],
        ['  Build   Bot  ', 'build-bot'],
        ['GitHub Notifications!', 'github-notifications'],
        ['Jenkins (CI) - Prod', 'jenkins-ci-prod'],
        ['my_bot.v2', 'my_bot.v2'],
        ['Café Résumé', 'cafe-resume'],
        ['123 Alerts', 'alerts'],
        ['--Alerts--', 'alerts'],
        ['Alerts.', 'alerts'],
        ['A very long display name for a bot', 'a-very-long-display-na'],
        ['A very long display n me', 'a-very-long-display-n'],
        ['🚀🚀🚀', ''],
        ['CI', ''],
        ['1 a', ''],
        ['System', ''],
        ['All', ''],
        ['CI Bot', 'ci-bot'],
    ])('%j -> %j', (displayName, expected) => {
        expect(usernameFromDisplayName(displayName)).toBe(expected);
    });

    test('produces valid bot usernames', () => {
        for (const displayName of ['Build Bot', 'Jenkins (CI) - Prod', 'Café Résumé', 'A very long display name for a bot', 'x.y.z.', 'abc']) {
            expect(isValidBotUsername(usernameFromDisplayName(displayName))).toBeUndefined();
        }
    });
});
