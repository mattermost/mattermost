// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import {getProfiles, getStatusesByIds} from 'mattermost-redux/actions/users';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import PopoutController from './popout_controller';

// Mock dependencies
vi.mock('mattermost-redux/actions/users', () => ({
    getProfiles: vi.fn().mockReturnValue(() => ({type: 'GET_PROFILES'})),
    getStatusesByIds: vi.fn().mockReturnValue(() => ({type: 'GET_STATUSES_BY_IDS'})),
}));

vi.mock('components/modal_controller', () => ({
    __esModule: true,
    default: () => <div data-testid='modal-controller'>{'Modal Controller'}</div>,
}));

vi.mock('components/thread_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='thread-popout'>{'Thread Popout'}</div>,
}));
vi.mock('utils/popouts/use_browser_popout', () => ({
    __esModule: true,
    useBrowserPopout: vi.fn(),
}));

vi.mock('components/logged_in', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='logged-in'>{children}</div>,
}));

const mockGetProfiles = getProfiles as ReturnType<typeof vi.fn>;
const mockGetStatusesByIds = getStatusesByIds as ReturnType<typeof vi.fn>;

// Base mock route props with meaningful route data
const baseRouteProps: RouteComponentProps = {
    history: {
        push: vi.fn(),
        replace: vi.fn(),
        go: vi.fn(),
        goBack: vi.fn(),
        goForward: vi.fn(),
        block: vi.fn(),
        listen: vi.fn(),
        createHref: vi.fn(),
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
        vi.clearAllMocks();

        // Reset document.body classes
        document.body.className = '';
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

    it('should dispatch getProfiles action on mount', () => {
        renderWithContext(
            <PopoutController {...baseRouteProps}/>,
        );

        expect(mockGetProfiles).toHaveBeenCalledTimes(1);
    });

    it('should render thread popout for thread route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post0000000000000000000123']}>
                <PopoutController {...baseRouteProps}/>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('thread-popout')).toBeInTheDocument();
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

    it('should dispatch getStatusesByIds with current user ID', () => {
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

        expect(mockGetStatusesByIds).toHaveBeenCalledTimes(1);
        expect(mockGetStatusesByIds).toHaveBeenCalledWith([currentUserId]);
    });
});
