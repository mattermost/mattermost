// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {ChannelComposerBanner} from './channel_composer_banner';

const makeState = (channelId: string, components: any[] = []) => ({
    entities: {
        channels: {
            channels: {
                [channelId]: TestHelper.getChannelMock({id: channelId}),
            },
        },
    },
    plugins: {
        components: {
            ChannelComposerBanner: components,
        },
    },
} as any);

describe('components/channel_view/ChannelComposerBanner', () => {
    const channelId = 'channel_id';

    test('no registered component — renders nothing', () => {
        const {container} = renderWithContext(
            <ChannelComposerBanner channelId={channelId}/>,
            makeState(channelId, []),
        );

        expect(container.firstChild).toBeNull();
    });

    test('registered component renders above the composer', () => {
        const state = makeState(channelId, [{
            id: 'banner-1',
            pluginId: 'test-plugin',
            component: () => <div data-testid='composer-banner-content'/>,
        }]);

        renderWithContext(
            <ChannelComposerBanner channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('composer-banner-content')).toBeInTheDocument();
    });

    test('missing channel — renders nothing', () => {
        const state = makeState(channelId, [{
            id: 'banner-1',
            pluginId: 'test-plugin',
            component: () => <div data-testid='composer-banner-content'/>,
        }]);

        // Remove the channel to simulate missing channel entity
        delete state.entities.channels.channels[channelId];

        const {container} = renderWithContext(
            <ChannelComposerBanner channelId={channelId}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('composer-banner-content')).not.toBeInTheDocument();
    });

    test('multiple registered components — all render in order', () => {
        const state = makeState(channelId, [
            {
                id: 'banner-1',
                pluginId: 'test-plugin',
                component: () => <div data-testid='composer-banner-content-1'/>,
            },
            {
                id: 'banner-2',
                pluginId: 'test-plugin',
                component: () => <div data-testid='composer-banner-content-2'/>,
            },
        ]);

        renderWithContext(
            <ChannelComposerBanner channelId={channelId}/>,
            state,
        );

        const first = screen.getByTestId('composer-banner-content-1');
        const second = screen.getByTestId('composer-banner-content-2');
        expect(first).toBeInTheDocument();
        expect(second).toBeInTheDocument();

        // First component precedes second in DOM order
        expect(first.compareDocumentPosition(second)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
});
