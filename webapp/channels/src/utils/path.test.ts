// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isBackstagePath} from './path';

describe('isBackstagePath', () => {
    test.each([
        '/team-one/integrations',
        '/team-one/integrations/bots/add',
        '/team-one/emoji',
        '/team-one/emoji/add',
    ])('should match %s', (pathname) => {
        expect(isBackstagePath(pathname)).toBe(true);
    });

    test.each([
        '/team-one/channels/integrations',
        '/team-one/channels/town-square',
        '/team-one/integrationsfoo',
        '/admin_console/integrations/bot_accounts',
        '/plug/mattermost-ai/agents',
    ])('should not match %s', (pathname) => {
        expect(isBackstagePath(pathname)).toBe(false);
    });
});
