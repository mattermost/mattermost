// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {getProfiles} from 'mattermost-redux/actions/users';

import {renderWithContext} from 'tests/react_testing_utils';

import PopoutController from './popout_controller';

// Mock dependencies
jest.mock('mattermost-redux/actions/users', () => ({
    getProfiles: jest.fn().mockReturnValue(() => ({type: 'GET_PROFILES'})),
}));

jest.mock('components/modal_controller', () => ({
    __esModule: true,
    default: () => <div data-testid='modal-controller'>{'Modal Controller'}</div>,
}));

jest.mock('components/thread_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='thread-popout'>{'Thread Popout'}</div>,
}));

const mockGetProfiles = getProfiles as jest.MockedFunction<typeof getProfiles>;

describe('PopoutController', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset document.body classes
        document.body.className = '';
    });

    it('should render modal controller', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('modal-controller')).toBeInTheDocument();
    });

    it('should add popout classes to document body on mount', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);
    });

    it('should dispatch getProfiles action on mount', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        expect(mockGetProfiles).toHaveBeenCalledTimes(1);
    });

    it('should render thread popout for thread route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('thread-popout')).toBeInTheDocument();
    });

    it('should maintain body classes on re-render', () => {
        const {rerender} = renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);

        // Re-render with different route
        rerender(
            <MemoryRouter initialEntries={['/_popout/thread/other-team/post-456']}>
                <PopoutController/>
            </MemoryRouter>,
        );

        // Classes should still be there
        expect(document.body.classList.contains('app__body')).toBe(true);
        expect(document.body.classList.contains('popout')).toBe(true);
    });
});
