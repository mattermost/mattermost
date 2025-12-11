// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import DraftRow from './draft_row';

describe('components/drafts/drafts_row', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id'});
    const user = TestHelper.getUserMock({id: 'user_id'});

    const baseProps: ComponentProps<typeof DraftRow> = {
        item: {
            channelId: 'channel_id',
            message: 'test message',
            fileInfos: [],
            uploadsInProgress: [],
            rootId: '',
            createAt: 0,
            updateAt: 0,
        } as PostDraft,
        user: user as UserProfile,
        status: 'online' as UserStatus['status'],
        displayName: 'test',
        isRemote: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                currentChannelId: 'channel_id',
                channels: {
                    channel_id: channel,
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: user,
                },
                profilesInChannel: {},
            },
            posts: {
                posts: {},
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
            groups: {
                groups: {},
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
        },
        views: {
            rhs: {
                isSidebarExpanded: false,
                isSidebarOpen: false,
            },
        },
    };

    it('should match snapshot for channel draft', () => {
        const {container} = renderWithContext(
            <DraftRow
                {...baseProps}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread draft', () => {
        const props = {
            ...baseProps,
            item: {
                ...baseProps.item,
                rootId: 'some_id',
            } as PostDraft,
        };

        const {container} = renderWithContext(
            <DraftRow
                {...props}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});
