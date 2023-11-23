// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

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

    test('should match snapshot, no headers', () => {
        const testChannels: Channel[] = [];

        const actions = {
            getData: jest.fn().mockResolvedValue(testChannels),
            searchAllChannels: jest.fn().mockResolvedValue(testChannels),
            removeGroup: jest.fn(),
        };

        const wrapper = shallow(
            <AbstractList
                onPageChangedCallback={jest.fn()}
                total={0}
                header={header}
                renderRow={renderRow}
                emptyListTextId={'test'}
                emptyListTextDefaultMessage={'test'}
                actions={actions}
            />);

        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with data', () => {
        const testTeams: TeamWithMembership[] = [TestHelper.getTeamMock({
            id: '123',
            display_name: 'DN',
        }) as TeamWithMembership];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchAllChannels: jest.fn().mockResolvedValue(testTeams),
            removeGroup: jest.fn(),
        };

        const wrapper = shallow(
            <AbstractList
                data={testTeams}
                onPageChangedCallback={jest.fn()}
                total={testTeams.length}
                header={header}
                renderRow={renderRow}
                emptyListTextId={'test'}
                emptyListTextDefaultMessage={'test'}
                actions={actions}
            />);

        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    const renderRow = jest.fn((item) => {
        return (
            <GroupRow
                key={item.id}
                group={item}
                removeGroup={jest.fn()}
                setNewGroupRole={jest.fn()}
                type='channel'
            />
        );
    });
});
