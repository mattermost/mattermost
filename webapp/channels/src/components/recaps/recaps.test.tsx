// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Recaps from './recaps';

const mockDispatch = jest.fn(() => Promise.resolve({data: []}));
const mockGetAgents = jest.fn(() => ({type: 'GET_AGENTS'}));
const mockGetRecaps = jest.fn((page: number, perPage: number) => ({type: 'GET_RECAPS', meta: {page, perPage}}));
const mockMarkRecapsAsViewed = jest.fn(() => ({type: 'MARK_RECAPS_VIEWED'}));
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
    markRecapsAsViewed: () => mockMarkRecapsAsViewed(),
}));

jest.mock('mattermost-redux/selectors/entities/recaps', () => ({
    getAllRecaps: jest.fn(() => []),
    getUnreadRecaps: jest.fn(() => []),
    getReadRecaps: jest.fn(() => []),
}));

jest.mock('actions/views/lhs', () => ({
    selectLhsItem: (type: string, id?: string) => mockSelectLhsItem(type, id),
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
        mockMarkRecapsAsViewed.mockClear();
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
        expect(mockGetAgents).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_LHS_ITEM'}));
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'GET_RECAPS'}));
        expect(mockDispatch).toHaveBeenCalledWith({type: 'GET_AGENTS'});

        // markRecapsAsViewed runs asynchronously after getRecaps resolves.
        await waitFor(() => expect(mockMarkRecapsAsViewed).toHaveBeenCalled());
        expect(mockDispatch).toHaveBeenCalledWith({type: 'MARK_RECAPS_VIEWED'});
    });
});
