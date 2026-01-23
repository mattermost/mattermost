// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DataSpillageFooter from './data_spillage_footer';

jest.mock('actions/views/rhs', () => ({
    selectPostFromRightHandSideSearch: jest.fn((post) => ({
        type: 'SELECT_POST_FROM_RHS_SEARCH',
        payload: post,
    })),
}));

const mockedSelectPostFromRightHandSideSearch = require('actions/views/rhs').selectPostFromRightHandSideSearch as jest.MockedFunction<any>;

describe('DataSpillageFooter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render footer with view details button', () => {
        const post = TestHelper.getPostMock();

        renderWithContext(
            <DataSpillageFooter post={post}/>,
        );

        expect(screen.getByTestId('data-spillage-footer')).toBeVisible();
        expect(screen.getByTestId('data-spillage-action-view-details')).toBeVisible();
        expect(screen.getByText('View details')).toBeVisible();
    });

    test('should dispatch selectPostFromRightHandSideSearch when button is clicked', async () => {
        const post = TestHelper.getPostMock({
            id: 'test_post_id',
            message: 'test message',
        });

        renderWithContext(
            <DataSpillageFooter post={post}/>,
        );

        const viewDetailsButton = screen.getByTestId('data-spillage-action-view-details');
        await userEvent.click(viewDetailsButton);

        expect(mockedSelectPostFromRightHandSideSearch).toHaveBeenCalledTimes(1);
        expect(mockedSelectPostFromRightHandSideSearch).toHaveBeenCalledWith(post);
    });
});
