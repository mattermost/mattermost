// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDecoratorRegistration} from 'types/store/plugins';

import PostDecoratorRenderer from './post_decorator_renderer';

const mockPost = TestHelper.getPostMock({id: 'post-1'});

const makeRegistration = (component: React.ComponentType<any>): PostDecoratorRegistration => ({
    id: 'reg-1',
    pluginId: 'test-plugin',
    slot: 'post_header_badge',
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

describe('components/post_decorator_renderer/PostDecoratorRenderer', () => {
    it('(a) renders the plugin component with post prop', () => {
        const PluginComponent = () => <div data-testid='plugin-component'/>;
        const reg = makeRegistration(PluginComponent);

        renderWithContext(
            <PostDecoratorRenderer
                registration={reg}
                post={mockPost}
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
            <PostDecoratorRenderer
                registration={reg}
                post={mockPost}
            />,
            minimalState,
        );

        expect(screen.getByTestId('theme-check')).toHaveAttribute('data-has-theme', 'true');
    });

    it('(c) injects webSocketClient prop into the plugin component', () => {
        const WsCheck = (props: {webSocketClient?: object}) => (
            <div
                data-testid='ws-check'
                data-has-websocket={Boolean(props.webSocketClient).toString()}
            />
        );
        const reg = makeRegistration(WsCheck);

        renderWithContext(
            <PostDecoratorRenderer
                registration={reg}
                post={mockPost}
            />,
            minimalState,
        );

        expect(screen.getByTestId('ws-check')).toHaveAttribute('data-has-websocket', 'true');
    });

    it('(d) error boundary catches a crashing component', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const Crasher = (): null => {
            throw new Error('test crash');
        };
        const reg = makeRegistration(Crasher);

        const {container} = renderWithContext(
            <PostDecoratorRenderer
                registration={reg}
                post={mockPost}
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
