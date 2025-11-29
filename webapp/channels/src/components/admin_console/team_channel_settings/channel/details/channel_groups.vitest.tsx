// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import {ChannelGroups} from './channel_groups';

describe('admin_console/team_channel_settings/channel/ChannelGroups', () => {
    test('should match snapshot', async () => {
        const groups: Group[] = [{
            id: '123',
            display_name: 'DN',
            member_count: 3,
        } as Group];

        const testChannel: Partial<Channel> & {team_name: string} = {
            id: '123',
            team_name: 'team',
            type: 'O',
            group_constrained: false,
            name: 'DN',
        };
        const {container} = renderWithContext(
            <ChannelGroups
                synced={true}
                onAddCallback={vi.fn()}
                onGroupRemoved={vi.fn()}
                removedGroups={[]}
                groups={groups}
                channel={testChannel}
                totalGroups={1}
                setNewGroupRole={vi.fn()}
                isDisabled={false}
            />,
        );
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
