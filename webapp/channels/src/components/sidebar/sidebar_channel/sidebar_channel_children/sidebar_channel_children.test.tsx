// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {clearLoggedSidebarChannelChildrenErrors} from 'selectors/sidebar_channel_children';

import {render, screen} from 'tests/react_testing_utils';

import type {SidebarChannelChildrenComponentProps, SidebarChannelChildrenRegistration} from 'types/store/plugins';

import SidebarChannelChildren from './sidebar_channel_children';

describe('components/sidebar/sidebar_channel/sidebar_channel_children', () => {
    const channel = {id: 'channel_id', type: 'D', name: 'user__agent'} as Channel;

    const registration = (id: string, pluginId: string, component: SidebarChannelChildrenRegistration['component']): SidebarChannelChildrenRegistration => ({
        id,
        pluginId,
        matcher: () => true,
        component,
    });

    beforeEach(() => {
        clearLoggedSidebarChannelChildrenErrors();
    });

    test('should render each registration with the channel, team name and current state', () => {
        const First = jest.fn(({channel: c, currentTeamName, isCurrentChannel}: SidebarChannelChildrenComponentProps) => (
            <div>{`first ${c.id} ${currentTeamName} ${isCurrentChannel}`}</div>
        ));
        const Second = () => <div>{'second'}</div>;

        render(
            <SidebarChannelChildren
                registrations={[registration('r1', 'plugin-a', First), registration('r2', 'plugin-b', Second)]}
                channel={channel}
                currentTeamName='team_name'
                isCurrentChannel={true}
            />,
        );

        expect(screen.getByText('first channel_id team_name true')).toBeInTheDocument();
        expect(screen.getByText('second')).toBeInTheDocument();
    });

    test('should hide a component that throws, log it once and keep the others', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const Broken = () => {
            throw new Error('boom');
        };
        const Healthy = () => <div>{'healthy'}</div>;

        const props = {
            registrations: [registration('r1', 'bad-plugin', Broken), registration('r2', 'good-plugin', Healthy)],
            channel,
            currentTeamName: 'team_name',
            isCurrentChannel: false,
        };
        const {rerender} = render(<SidebarChannelChildren {...props}/>);

        expect(screen.getByText('healthy')).toBeInTheDocument();

        rerender(<SidebarChannelChildren {...props}/>);
        const pluginLogs = consoleSpy.mock.calls.filter((call) => String(call[0]).includes("plugin 'bad-plugin'"));
        expect(pluginLogs).toHaveLength(1);

        consoleSpy.mockRestore();
    });
});
