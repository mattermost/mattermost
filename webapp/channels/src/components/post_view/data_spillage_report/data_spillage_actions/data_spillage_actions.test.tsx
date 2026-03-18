// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DataSpillageAction from './data_spillage_actions';

describe('DataSpillageAction', () => {
    test('should render both action buttons', () => {
        const flaggedPost = TestHelper.getPostMock();
        const reportingUser = TestHelper.getUserMock();

        renderWithContext(
            <DataSpillageAction
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
            />,
        );

        expect(screen.getByTestId('data-spillage-action')).toBeInTheDocument();
        expect(screen.getByTestId('data-spillage-action-remove-message')).toBeInTheDocument();
        expect(screen.getByTestId('data-spillage-action-keep-message')).toBeInTheDocument();
    });
});
