// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as ReactRedux from 'react-redux';
import {MemoryRouter, Route, useHistory} from 'react-router-dom';

import {openModal} from 'actions/views/modals';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import QueryParamActionController from './query_param_action_controller';

// Mock react-redux since we just care about calling logic
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: vi.fn(),
    };
});

vi.mock('actions/views/modals', () => ({
    openModal: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useHistory: vi.fn(),
    };
});

describe('QueryParamActionController', () => {
    let mockDispatch: ReturnType<typeof vi.fn>;

    // Define a custom type for mockHistory that includes the replace method
    interface MockHistory {
        replace: ReturnType<typeof vi.fn>;
    }
    let mockHistory: MockHistory;

    beforeEach(() => {
        mockDispatch = vi.fn();
        vi.spyOn(ReactRedux, 'useDispatch').mockReturnValue(mockDispatch as any);
        mockHistory = {
            replace: vi.fn(),
        };
        vi.mocked(useHistory).mockReturnValue(mockHistory as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should dispatch openModal for INVITATION modal ID when passed valid open_invitation_modal action', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/?action=open_invitation_modal']}>
                <Route
                    path='/'
                    component={QueryParamActionController}
                />
            </MemoryRouter>,
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            openModal({
                modalId: 'INVITATION',
                dialogType: expect.any(Function),
            }),
        );
    });

    it('should not dispatch any action when action query parameter is not present', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/']}>
                <Route
                    path='/'
                    component={QueryParamActionController}
                />
            </MemoryRouter>,
        );

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should not dispatch any action when action query parameter is not in list', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/?action=invalid_action']}>
                <Route
                    path='/'
                    component={QueryParamActionController}
                />
            </MemoryRouter>,
        );

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should remove the action query parameter after dispatching the action', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/?action=open_invitation_modal']}>
                <Route
                    path='/'
                    component={QueryParamActionController}
                />
            </MemoryRouter>,
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            openModal({
                modalId: 'INVITATION',
                dialogType: expect.any(Function),
            }),
        );

        expect(mockHistory.replace).toHaveBeenCalledWith({
            search: '',
        });
    });
});
