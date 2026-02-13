// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import {getMe} from 'mattermost-redux/actions/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {loadStatusesByIds} from 'actions/status_actions';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PopoutController from './popout_controller';

// Mock dependencies
jest.mock('mattermost-redux/actions/users', () => ({
    getMe: jest.fn(),
}));

jest.mock('actions/status_actions', () => ({
    loadStatusesByIds: jest.fn(),
}));

jest.mock('components/modal_controller', () => ({
    __esModule: true,
    default: () => <div data-testid='modal-controller'>{'Modal Controller'}</div>,
}));

jest.mock('components/thread_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='thread-popout'>{'Thread Popout'}</div>,
}));

jest.mock('components/rhs_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='rhs-popout'>{'RHS Popout'}</div>,
}));
jest.mock('utils/popouts/use_browser_popout', () => ({
    __esModule: true,
    useBrowserPopout: jest.fn(),
}));

jest.mock('components/logged_in', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='logged-in'>{children}</div>,
}));

jest.mock('plugins/pluggable', () => ({
    __esModule: true,
    default: ({pluggableName}: {pluggableName: string}) => (
        <div data-testid={`pluggable-${pluggableName}`}>{`Pluggable: ${pluggableName}`}</div>
    ),
}));

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockLoadStatusesByIds = loadStatusesByIds as jest.MockedFunction<typeof loadStatusesByIds>;

// Base mock route props with meaningful route data
const baseRouteProps: RouteComponentProps = {
    history: {
        push: jest.fn(),
        replace: jest.fn(),
        go: jest.fn(),
        goBack: jest.fn(),
        goForward: jest.fn(),
        block: jest.fn(),
        listen: jest.fn(),
        createHref: jest.fn(),
    } as any,
    location: {
        pathname: '/_popout/thread/test-team/post0000000000000000000123',
        search: '',
        hash: '',
        state: null,
        key: 'test-key',
    },
    match: {
        params: {team: 'test-team', postId: 'post0000000000000000000123'},
        isExact: true,
        path: '/_popout/thread/:team/:postId',
        url: '/_popout/thread/test-team/post0000000000000000000123',
    },
};

describe('PopoutController', () => {
    beforeEach(() => {
        // Reset document.body classes
        document.body.className = '';

        // Setup default mock for getMe to return a promise that resolves
        const mockUser = TestHelper.getUserMock({id: 'user-123', username: 'testuser'});
        mockGetMe.mockReturnValue(() => Promise.resolve({
            data: mockUser,
        } as ActionResult<UserProfile>));

        // Setup default mocks for status actions
        mockLoadStatusesByIds.mockReturnValue(() => ({
            data: true,
        } as ActionResult<boolean>));
    });

    it('should render modal controller', () => {
        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(screen.getByTestId('modal-controller')).toBeInTheDocument();
    });

    it('should add popout classes to document body on mount', () => {
        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);
    });

    it('should dispatch getMe action on mount', () => {
        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(mockGetMe).toHaveBeenCalledTimes(1);
    });

    it('should render thread popout for thread route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post0000000000000000000123']}>
                <PopoutController {...baseRouteProps}/>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('thread-popout')).toBeInTheDocument();
    });

    it('should render rhs popout for rhs route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/test-team/channel-identifier']}>
                <PopoutController {...baseRouteProps}/>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('rhs-popout')).toBeInTheDocument();
    });

    it('should maintain body classes on re-render', () => {
        const {rerender} = renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);

        // Re-render with different route params
        const differentRouteProps = {
            ...baseRouteProps,
            location: {
                ...baseRouteProps.location,
                pathname: '/_popout/thread/different-team/different-post',
            },
            match: {
                ...baseRouteProps.match,
                params: {team: 'different-team', postId: 'different-post'},
                url: '/_popout/thread/different-team/different-post',
            },
        };
        rerender(
            <PopoutController {...differentRouteProps}/>,
        );

        // Classes should still be there
        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);
    });

    it('should dispatch loadStatusesByIds with current user ID', () => {
        const currentUserId = 'current-user-id-123';
        const initialState = {
            entities: {
                users: {
                    currentUserId,
                },
            },
        };

        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
            initialState,
        );

        expect(mockLoadStatusesByIds).toHaveBeenCalledTimes(1);
        expect(mockLoadStatusesByIds).toHaveBeenCalledWith([currentUserId]);
    });

    it('should render Pluggable for Root', () => {
        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(screen.getByTestId('pluggable-Root')).toBeInTheDocument();
        expect(screen.getByText('Pluggable: Root')).toBeInTheDocument();
    });
});
