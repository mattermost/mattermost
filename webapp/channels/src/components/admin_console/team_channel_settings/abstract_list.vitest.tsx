// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AbstractList from './abstract_list';
import GroupRow from './group/group_row';

import type {TeamWithMembership} from '../system_user_detail/team_list/types';

describe('admin_console/team_channel_settings/AbstractList', () => {
    const header = (
        <div className='groups-list--header'>
            <div className='group-name adjusted'>
                <FormattedMessage
                    id='admin.channel_settings.channel_list.nameHeader'
                    defaultMessage='Name'
                />
            </div>
            <div className='group-content'>
                <div className='group-description'>
                    <FormattedMessage
                        id='admin.channel_settings.channel_list.teamHeader'
                        defaultMessage='Team'
                    />
                </div>
                <div className='group-description adjusted'>
                    <FormattedMessage
                        id='admin.channel_settings.channel_list.managementHeader'
                        defaultMessage='Management'
                    />
                </div>
                <div className='group-actions'/>
            </div>
        </div>);

    const renderRow = vi.fn((item) => {
        return (
            <GroupRow
                key={item.id}
                group={item}
                removeGroup={vi.fn()}
                setNewGroupRole={vi.fn()}
                type='channel'
            />
        );
    });

    test('should match snapshot, no headers', async () => {
        const testChannels: Channel[] = [];

        const actions = {
            getData: vi.fn().mockResolvedValue(testChannels),
            searchAllChannels: vi.fn().mockResolvedValue(testChannels),
            removeGroup: vi.fn(),
        };

        const {container} = renderWithContext(
            <AbstractList
                onPageChangedCallback={vi.fn()}
                total={0}
                header={header}
                renderRow={renderRow}
                emptyListText={{
                    id: 'test',
                    defaultMessage: 'test',
                }}
                actions={actions}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('test')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with data', async () => {
        const testTeams: TeamWithMembership[] = [TestHelper.getTeamMock({
            id: '123',
            display_name: 'DN',
        }) as TeamWithMembership];

        const actions = {
            getData: vi.fn().mockResolvedValue(testTeams),
            searchAllChannels: vi.fn().mockResolvedValue(testTeams),
            removeGroup: vi.fn(),
        };

        const {container} = renderWithContext(
            <AbstractList
                data={testTeams}
                onPageChangedCallback={vi.fn()}
                total={testTeams.length}
                header={header}
                renderRow={renderRow}
                emptyListText={{
                    id: 'test',
                    defaultMessage: 'test',
                }}
                actions={actions}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('DN')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
