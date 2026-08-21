// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';

import {RHSStates} from 'utils/constants';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Recaps from './recaps';

const mockDispatch = jest.fn(() => Promise.resolve({data: []}));
const mockGetAgents = jest.fn(() => ({type: 'GET_AGENTS'}));
const mockGetRecaps = jest.fn((page: number, perPage: number) => ({type: 'GET_RECAPS', meta: {page, perPage}}));
const mockGetScheduledRecaps = jest.fn((page: number, perPage: number) => ({type: 'GET_SCHEDULED_RECAPS', meta: {page, perPage}}));
const mockFetchRecapLimitStatus = jest.fn(() => ({type: 'GET_RECAP_LIMIT_STATUS'}));
const mockMarkRecapsAsViewed = jest.fn(() => ({type: 'MARK_RECAPS_VIEWED'}));
const mockGetRhsState = jest.fn(() => null);
const mockSelectLhsItem = jest.fn((type: string, id?: string) => {
    return {type: 'SELECT_LHS_ITEM', meta: {lhsType: type, id}};
});

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
    useSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: () => mockGetAgents(),
}));

jest.mock('mattermost-redux/actions/recaps', () => ({
    getRecaps: (page: number, perPage: number) => mockGetRecaps(page, perPage),
    getScheduledRecaps: (page: number, perPage: number) => mockGetScheduledRecaps(page, perPage),
    getRecapLimitStatus: () => mockFetchRecapLimitStatus(),
    markRecapsAsViewed: () => mockMarkRecapsAsViewed(),
}));

jest.mock('mattermost-redux/selectors/entities/recaps', () => ({
    getAllRecaps: jest.fn(() => []),
    getUnreadRecaps: jest.fn(() => []),
    getReadRecaps: jest.fn(() => []),
    getAllScheduledRecaps: jest.fn(() => []),
    getRecapLimitStatus: jest.fn(() => null),
}));

jest.mock('actions/views/lhs', () => ({
    selectLhsItem: (type: string, id?: string) => mockSelectLhsItem(type, id),
}));

jest.mock('selectors/rhs', () => ({
    getRhsState: () => mockGetRhsState(),
}));

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));

jest.mock('components/common/hooks/useGetAgentsBridgeEnabled', () => jest.fn(() => ({available: true})));
jest.mock('components/common/hooks/useGetFeatureFlagValue', () => jest.fn(() => 'true'));
jest.mock('components/create_recap_modal', () => () => <div data-testid='create-recap-modal'/>);
jest.mock('./recaps_list', () => ({__esModule: true, default: () => <div data-testid='recaps-list'/>}));

describe('components/recaps/Recaps', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockGetAgents.mockClear();
        mockGetRecaps.mockClear();
        mockGetScheduledRecaps.mockClear();
        mockFetchRecapLimitStatus.mockClear();
        mockMarkRecapsAsViewed.mockClear();
        mockGetRhsState.mockClear();
        mockGetRhsState.mockReturnValue(null);
        mockSelectLhsItem.mockClear();
    });

    test('selects Recaps in the LHS on mount', async () => {
        renderWithContext(
            <MemoryRouter>
                <Recaps/>
            </MemoryRouter>,
        );

        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Recaps);
        expect(mockGetRecaps).toHaveBeenCalledWith(0, 60);
        expect(mockGetScheduledRecaps).toHaveBeenCalledWith(0, 60);
        expect(mockGetAgents).toHaveBeenCalled();
        expect(mockFetchRecapLimitStatus).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_LHS_ITEM'}));
        expect(mockDispatch).toHaveBeenCalledWith({type: 'SUPPRESS_RHS'});
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'GET_RECAPS'}));
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'GET_SCHEDULED_RECAPS'}));
        expect(mockDispatch).toHaveBeenCalledWith({type: 'GET_AGENTS'});
        expect(mockDispatch).toHaveBeenCalledWith({type: 'GET_RECAP_LIMIT_STATUS'});

        // markRecapsAsViewed runs asynchronously after getRecaps resolves.
        await waitFor(() => expect(mockMarkRecapsAsViewed).toHaveBeenCalled());
        expect(mockDispatch).toHaveBeenCalledWith({type: 'MARK_RECAPS_VIEWED'});
    });

    test('restores the RHS when Recaps unmounts', async () => {
        const {unmount} = renderWithContext(
            <MemoryRouter>
                <Recaps/>
            </MemoryRouter>,
        );

        await waitFor(() => expect(mockMarkRecapsAsViewed).toHaveBeenCalled());
        unmount();

        expect(mockDispatch).toHaveBeenCalledWith({type: 'UNSUPPRESS_RHS'});
    });

    test.each([
        ['mentions', RHSStates.MENTION],
        ['search', RHSStates.SEARCH],
        ['saved posts', RHSStates.FLAG],
    ])('does not suppress the RHS when %s is open', async (_label, rhsState) => {
        mockGetRhsState.mockReturnValue(rhsState);

        const {unmount} = renderWithContext(
            <MemoryRouter>
                <Recaps/>
            </MemoryRouter>,
        );

        expect(mockDispatch).not.toHaveBeenCalledWith({type: 'SUPPRESS_RHS'});

        await waitFor(() => expect(mockMarkRecapsAsViewed).toHaveBeenCalled());
        unmount();

        expect(mockDispatch).toHaveBeenCalledWith({type: 'UNSUPPRESS_RHS'});
    });
});
