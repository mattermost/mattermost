// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {checkUserInCall} from './call_button';

describe('checkUserInCall', () => {
    test('missing state', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {},
        } as any, 'userA')).toBe(false);
    });

    test('call state missing', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                profiles: {
                    channelID: null,
                },
            },
        } as any, 'userA')).toBe(false);
    });

    test('user not in call', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                profiles: {
                    channelID: {
                        sessionB: {
                            id: 'userB',
                        },
                    },
                },
            },
        } as any, 'userA')).toBe(false);
    });

    test('user in call', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                profiles: {
                    channelID: {
                        sessionB: {
                            id: 'userB',
                        },
                        sessionA: {
                            id: 'userA',
                        },
                    },
                },
            },
        } as any, 'userA')).toBe(true);
    });
});
