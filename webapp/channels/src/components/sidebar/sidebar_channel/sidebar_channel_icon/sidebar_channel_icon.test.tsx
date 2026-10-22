// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import SidebarChannelIcon from './sidebar_channel_icon';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(overrides: any[] = []) {
    return {plugins: {components: {ChannelIconOverride: overrides}}} as any;
}

const baseIcon = <i className='icon icon-globe'/>;

describe('components/sidebar/sidebar_channel/sidebar_channel_icon', () => {
    test('should render the provided icon when channel is not deleted', () => {
        const {container} = renderWithContext(
            <SidebarChannelIcon
                channel={makeChannel({type: 'O', delete_at: 0})}
                icon={baseIcon}
            />,
        );

        expect(container.querySelector('.icon-globe')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-outline')).not.toBeInTheDocument();
        expect(container.querySelector('.icon-archive-lock-outline')).not.toBeInTheDocument();
    });

    test('should render archive icon for deleted public channel', () => {
        const {container} = renderWithContext(
            <SidebarChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1})}
                icon={baseIcon}
            />,
        );

        expect(container.querySelector('.icon-archive-outline')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-lock-outline')).not.toBeInTheDocument();
    });

    test('should render archive-lock icon for deleted private channel', () => {
        const {container} = renderWithContext(
            <SidebarChannelIcon
                channel={makeChannel({type: 'P', delete_at: 1})}
                icon={baseIcon}
            />,
        );

        expect(container.querySelector('.icon-archive-lock-outline')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-outline')).not.toBeInTheDocument();
    });

    test('should render override icon for archived channel when matcher matches', () => {
        const {container} = renderWithContext(
            <SidebarChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1})}
                icon={baseIcon}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(container.querySelector('.icon-archive-outline')).not.toBeInTheDocument();
    });

    test('should render archive fallback for archived channel when matcher returns false', () => {
        const {container} = renderWithContext(
            <SidebarChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1})}
                icon={baseIcon}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]),
        );

        expect(container.querySelector('.icon-archive-outline')).toBeInTheDocument();
    });
});
