// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getAgents} from 'mattermost-redux/actions/agents';
import {getRecaps} from 'mattermost-redux/actions/recaps';

import {selectLhsItem} from 'actions/views/lhs';

import {renderWithContext} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Recaps from './recaps';

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('mattermost-redux/actions/recaps', () => ({
    getRecaps: jest.fn(() => ({type: 'GET_RECAPS'})),
}));

jest.mock('actions/views/lhs', () => ({
    selectLhsItem: jest.fn(() => ({type: 'SELECT_LHS_ITEM'})),
}));

jest.mock('components/common/hooks/useGetAgentsBridgeEnabled', () => () => ({available: true}));
jest.mock('components/common/hooks/useGetFeatureFlagValue', () => () => 'true');
jest.mock('./recaps_list', () => () => <div>{'Recaps List'}</div>);

describe('components/recaps/Recaps', () => {
    beforeEach(() => {
        mockState = {
            entities: {
                recaps: {
                    byId: {},
                    allIds: [],
                },
            },
        };

        mockDispatch.mockClear();
        jest.mocked(getAgents).mockClear();
        jest.mocked(getRecaps).mockClear();
        jest.mocked(selectLhsItem).mockClear();
    });

    test('selects Recaps in the LHS when mounted', () => {
        renderWithContext(<Recaps/>);

        expect(selectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Recaps);
        expect(mockDispatch).toHaveBeenCalledWith({type: 'SELECT_LHS_ITEM'});
        expect(getRecaps).toHaveBeenCalledWith(0, 60);
        expect(getAgents).toHaveBeenCalled();
    });
});
