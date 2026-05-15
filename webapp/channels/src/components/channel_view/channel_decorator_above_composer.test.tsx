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

import {ChannelDecoratorAboveComposer} from './channel_decorator_above_composer';

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

describe('components/channel_view/ChannelDecoratorAboveComposer', () => {
    const channelId = 'channel_id';

    test('no decorator — renders null (nothing in DOM)', () => {
        const {container} = renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            makeState(channelId, []),
        );

        expect(container.firstChild).toBeNull();
    });

    test('decorator matched — rendered above composer', () => {
        const state = makeState(channelId, [{
            id: 'above-1',
            pluginId: 'test-plugin',
            slot: 'above_composer',
            matcher: () => true,
            component: () => null,
        }]);

        renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-above-1')).toBeInTheDocument();
    });

    test('decorator not matched — renders null', () => {
        const state = makeState(channelId, [{
            id: 'above-1',
            pluginId: 'test-plugin',
            slot: 'above_composer',
            matcher: () => false,
            component: () => null,
        }]);

        const {container} = renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('decorator-above-1')).not.toBeInTheDocument();
    });

    test('multiple decorators — all rendered in order', () => {
        const state = makeState(channelId, [
            {
                id: 'above-1',
                pluginId: 'test-plugin',
                slot: 'above_composer',
                matcher: () => true,
                component: () => null,
            },
            {
                id: 'above-2',
                pluginId: 'test-plugin',
                slot: 'above_composer',
                matcher: () => true,
                component: () => null,
            },
        ]);

        renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-above-1')).toBeInTheDocument();
        expect(screen.getByTestId('decorator-above-2')).toBeInTheDocument();
    });
});
