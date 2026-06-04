// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isBackstageRoute} from './path';

describe('isBackstageRoute', () => {
    it.each([
        '/myteam/integrations',
        '/myteam/integrations/',
        '/myteam/integrations/bots',
        '/myteam/integrations/incoming_webhooks',
        '/myteam/emoji',
        '/myteam/emoji/add',
        '/my-team_1/integrations',
    ])('returns true for backstage route %s', (pathname) => {
        expect(isBackstageRoute(pathname)).toBe(true);
    });

    it.each([
        '/myteam/channels/town-square',
        '/myteam/messages/@someone',
        '/myteam/channels/integrations',
        '/admin_console/integrations/bot_accounts',
        '/create_team',
        '/select_team',
        '/plug/some-plugin',
        '/',
    ])('returns false for non-backstage route %s', (pathname) => {
        expect(isBackstageRoute(pathname)).toBe(false);
    });
});
