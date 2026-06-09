// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
            component: () => <div data-testid='decorator-content-above-1'/>,
        }]);

        renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-content-above-1')).toBeInTheDocument();
    });

    test('decorator not matched — renders null', () => {
        const state = makeState(channelId, [{
            id: 'above-1',
            pluginId: 'test-plugin',
            slot: 'above_composer',
            matcher: () => false,
            component: () => <div data-testid='decorator-content-above-1'/>,
        }]);

        const {container} = renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('decorator-content-above-1')).not.toBeInTheDocument();
    });

    test('multiple decorators — all rendered in order', () => {
        const state = makeState(channelId, [
            {
                id: 'above-1',
                pluginId: 'test-plugin',
                slot: 'above_composer',
                matcher: () => true,
                component: () => <div data-testid='decorator-content-above-1'/>,
            },
            {
                id: 'above-2',
                pluginId: 'test-plugin',
                slot: 'above_composer',
                matcher: () => true,
                component: () => <div data-testid='decorator-content-above-2'/>,
            },
        ]);

        renderWithContext(
            <ChannelDecoratorAboveComposer channelId={channelId}/>,
            state,
        );

        const first = screen.getByTestId('decorator-content-above-1');
        const second = screen.getByTestId('decorator-content-above-2');
        expect(first).toBeInTheDocument();
        expect(second).toBeInTheDocument();

        // Verify DOM order: first precedes second
        expect(first.compareDocumentPosition(second)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
});
