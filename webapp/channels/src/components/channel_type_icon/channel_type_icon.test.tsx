// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelTypeIcon from './channel_type_icon';

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

describe('components/ChannelTypeIcon', () => {
    it('renders icon-globe for an open channel', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={makeChannel({type: 'O'})}/>,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-globe');
    });

    it('renders icon-lock-outline for a private channel', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={makeChannel({type: 'P'})}/>,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-lock-outline');
    });

    it('renders icon-archive-outline for an archived open channel', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={makeChannel({type: 'O', delete_at: 1234})}/>,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-archive-outline');
    });

    it('renders icon-archive-lock-outline for an archived private channel', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={makeChannel({type: 'P', delete_at: 1234})}/>,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-archive-lock-outline');
    });

    it('renders icon-globe when channel is missing', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon/>,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-globe');
    });

    it('renders the override icon class when a matcher matches', () => {
        const channel = makeChannel({type: 'O'});
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={channel}/>,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-shield-outline');
        expect(el).not.toHaveClass('icon-globe');
    });

    it('falls back to core icon when matcher returns false', () => {
        const channel = makeChannel({type: 'P'});
        const {container} = renderWithContext(
            <ChannelTypeIcon channel={channel}/>,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-lock-outline');
    });

    it('falls back to core icon when matcher throws', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const channel = makeChannel({type: 'O'});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const {container} = renderWithContext(
                <ChannelTypeIcon channel={channel}/>,
                makeState([{
                    id: '1',
                    pluginId: `bad-plugin-component-${Date.now()}`,
                    matcher: throwingMatcher,
                    iconName: 'shield-outline',
                }]),
            );
            const el = container.querySelector('i');
            expect(el).toHaveClass('icon', 'icon-globe');
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('appends extra className prop', () => {
        const {container} = renderWithContext(
            <ChannelTypeIcon
                channel={makeChannel()}
                className='extra-class'
            />,
            makeState(),
        );
        const el = container.querySelector('i');
        expect(el).toHaveClass('icon', 'icon-globe', 'extra-class');
    });

    it('passes through extra HTML attributes', () => {
        renderWithContext(
            <ChannelTypeIcon
                channel={makeChannel()}
                data-testid='channel-icon'
            />,
            makeState(),
        );
        expect(screen.getByTestId('channel-icon')).toBeInTheDocument();
    });
});
