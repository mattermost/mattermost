// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isUserInCall} from './index';

describe('isUserInCall', () => {
    test('missing state', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {},
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('call state missing', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: null,
                },
            },
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('user not in call', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: {
                        sessionB: {
                            user_id: 'userB',
                        },
                    },
                },
            },
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('user in call', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: {
                        sessionB: {
                            user_id: 'userB',
                        },
                        sessionA: {
                            user_id: 'userA',
                        },
                    },
                },
            },
        } as any, 'userA', 'channelID')).toBe(true);
    });
});
