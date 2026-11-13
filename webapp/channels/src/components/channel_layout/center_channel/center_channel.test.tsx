// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import CenterChannel from './center_channel';

import type {OwnProps} from './index';

jest.mock('components/async_load', () => ({
    makeAsyncComponent: (name: string) => {
        const Component = () => <div data-testid={name}/>;
        Component.displayName = name;
        return Component;
    },
}));

jest.mock('components/channel_layout/channel_identifier_router', () => ({
    __esModule: true,
    default: ({match}: RouteComponentProps<Record<string, string | undefined>>) => (
        <div
            data-testid='channel-identifier-router'
            data-params={JSON.stringify(match.params)}
        />
    ),
}));

describe('components/channel_layout/CenterChannel', () => {
    const props = {
        location: {
            pathname: '/some',
        } as OwnProps['location'],
        match: {
            url: '/url',
        } as OwnProps['match'],
        history: {} as OwnProps['history'],
        lastChannelPath: '',
        lhsOpen: true,
        rhsOpen: true,
        rhsMenuOpen: true,
        isCollapsedThreadsEnabled: true,
        currentUserId: 'testUserId',
        isMobileView: false,
        actions: {
            getProfiles: jest.fn(),
        },
    };
    test('should call update returnTo on props change', () => {
        let state = {returnTo: '', lastReturnTo: ''};

        // Simulate initial render with pathname '/some'
        let derived = CenterChannel.getDerivedStateFromProps(props as any, state);
        state = {...state, ...derived};
        expect(state.returnTo).toBe('');

        // Simulate props change to '/pl/path'
        derived = CenterChannel.getDerivedStateFromProps(
            {...props, location: {pathname: '/pl/path'}} as any,
            state,
        );
        state = {...state, ...derived};
        expect(state.returnTo).toBe('/some');

        // Simulate props change to '/pl/path1'
        derived = CenterChannel.getDerivedStateFromProps(
            {...props, location: {pathname: '/pl/path1'}} as any,
            state,
        );
        state = {...state, ...derived};
        expect(state.returnTo).toBe('/pl/path');
    });

    describe('channel routes', () => {
        const postId = 'abcdefghijklmnopqrstuvwxyz';

        function renderAt(path: string) {
            const {unmount} = render(
                <MemoryRouter initialEntries={[path]}>
                    <Route
                        path='/:team'
                        render={(routeProps) => (
                            <CenterChannel
                                {...props}
                                {...routeProps}
                            />
                        )}
                    />
                </MemoryRouter>,
            );
            const params = JSON.parse(screen.getByTestId('channel-identifier-router').getAttribute('data-params')!);
            unmount();
            return params;
        }

        test('matches a plain channel', () => {
            expect(renderAt('/team/channels/town-square')).toEqual({team: 'team', path: 'channels', identifier: 'town-square'});
        });

        test('matches a 26-character id after the channel as a permalink', () => {
            expect(renderAt(`/team/channels/town-square/${postId}`)).toEqual({team: 'team', path: 'channels', identifier: 'town-square', postid: postId});
            expect(renderAt(`/team/messages/@user/${postId}`)).toEqual({team: 'team', path: 'messages', identifier: '@user', postid: postId});
        });

        test('matches anything else after a channel as a sub-path', () => {
            expect(renderAt('/team/channels/town-square/pages/abc123')).toEqual({team: 'team', path: 'channels', identifier: 'town-square', subpath: 'pages/abc123'});
            expect(renderAt('/team/channels/town-square/settings')).toEqual({team: 'team', path: 'channels', identifier: 'town-square', subpath: 'settings'});
        });

        test('does not match sub-paths for direct messages', () => {
            expect(renderAt('/team/messages/@user/pages/abc123')).toEqual({team: 'team', path: 'messages', identifier: '@user'});
        });
    });
});
