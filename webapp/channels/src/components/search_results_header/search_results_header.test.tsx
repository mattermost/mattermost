// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen} from 'tests/react_testing_utils';
import {RhsState} from 'types/store/rhs';
import {RHSStates} from 'utils/constants';

import Header from './search_results_header';

describe('search_results_header', () => {
    test('should display back button when the parent is channel info', () => {
        renderWithIntl(
            <Header
                previousRhsState={RHSStates.CHANNEL_INFO as RhsState}
                canGoBack={true}
                isExpanded={false}
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </Header>,
        );

        expect(screen.getByLabelText('Back Icon')).toBeInTheDocument();
    });
    test('should NOT diplay expand when the parent is channel info', () => {
        renderWithIntl(
            <Header
                previousRhsState={RHSStates.CHANNEL_INFO as RhsState}
                canGoBack={true}
                isExpanded={false}
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </Header>,
        );

        expect(screen.queryByLabelText('Expand Sidebar Icon')).not.toBeInTheDocument();
    });
    test('should diplay expand when the parent is NOT channel info', () => {
        renderWithIntl(
            <Header
                previousRhsState={RHSStates.FLAG as RhsState}
                canGoBack={true}
                isExpanded={false}
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </Header>,
        );

        expect(screen.getByLabelText('Expand Sidebar Icon')).toBeInTheDocument();
    });
});
