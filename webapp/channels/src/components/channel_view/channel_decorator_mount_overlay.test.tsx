// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_decorator_renderer/channel_decorator_renderer', () => {
    return ({registration}: {registration: {id: string}}) => (
        <div data-testid={`decorator-${registration.id}`}/>
    );
});

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {ChannelDecoratorMountOverlay} from './channel_decorator_mount_overlay';

const makeState = (channelId: string, decorators: any[] = []) => ({
    entities: {
        channels: {
            channels: {
                [channelId]: TestHelper.getChannelMock({id: channelId}),
            },
        },
    },
    plugins: {
        components: {
            ChannelDecorator: decorators,
        },
    },
} as any);

describe('components/channel_view/ChannelDecoratorMountOverlay', () => {
    const channelId = 'channel_id';

    test('no decorator — no overlay div rendered', () => {
        const {container} = renderWithContext(
            <ChannelDecoratorMountOverlay channelId={channelId}/>,
            makeState(channelId, []),
        );

        expect(container.firstChild).toBeNull();
        expect(document.querySelector('.channel-decorator-mount-overlay')).not.toBeInTheDocument();
    });

    test('decorator matched — overlay rendered with decorator inside', () => {
        const state = makeState(channelId, [{
            id: 'overlay-1',
            pluginId: 'test-plugin',
            slot: 'mount_overlay',
            matcher: () => true,
            component: () => null,
        }]);

        renderWithContext(
            <ChannelDecoratorMountOverlay channelId={channelId}/>,
            state,
        );

        expect(document.querySelector('.channel-decorator-mount-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('decorator-overlay-1')).toBeInTheDocument();
    });
});
