// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelDecoratorRegistration} from 'types/store/plugins';

import ChannelDecoratorRenderer from './channel_decorator_renderer';

const mockChannel = TestHelper.getChannelMock({id: 'channel-1'});

const makeRegistration = (component: React.ComponentType<any>): ChannelDecoratorRegistration => ({
    id: 'reg-1',
    pluginId: 'test-plugin',
    slot: 'left_of_channel_name',
    matcher: () => true,
    component,
});

const minimalState = {
    entities: {
        general: {config: {}},
        preferences: {myPreferences: {}},
        users: {currentUserId: 'user1', profiles: {}},
    },
} as any;

describe('components/channel_decorator_renderer/ChannelDecoratorRenderer', () => {
    it('(a) renders the plugin component with channel prop', () => {
        const PluginComponent = () => <div data-testid='plugin-component'/>;
        const reg = makeRegistration(PluginComponent);

        renderWithContext(
            <ChannelDecoratorRenderer
                registration={reg}
                channel={mockChannel}
            />,
            minimalState,
        );

        expect(screen.getByTestId('plugin-component')).toBeInTheDocument();
    });

    it('(b) injects theme prop into the plugin component', () => {
        const ThemeCheck = (props: {theme?: object}) => (
            <div
                data-testid='theme-check'
                data-has-theme={Boolean(props.theme).toString()}
            />
        );
        const reg = makeRegistration(ThemeCheck);

        renderWithContext(
            <ChannelDecoratorRenderer
                registration={reg}
                channel={mockChannel}
            />,
            minimalState,
        );

        expect(screen.getByTestId('theme-check')).toHaveAttribute('data-has-theme', 'true');
    });

    it('(c) error boundary catches a crashing component', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const Crasher = (): null => {
            throw new Error('test crash');
        };
        const reg = makeRegistration(Crasher);

        const {container} = renderWithContext(
            <ChannelDecoratorRenderer
                registration={reg}
                channel={mockChannel}
            />,
            minimalState,
        );

        // Error boundary fallback renders a message and a refresh link
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
        expect(screen.getByText(/Refresh/i)).toBeInTheDocument();

        // Container is still mounted — the crash did not tear down the host DOM
        expect(container).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
