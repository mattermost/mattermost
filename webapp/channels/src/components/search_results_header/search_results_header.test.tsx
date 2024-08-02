// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

import SearchResultsHeader from './search_results_header';

describe('search_results_header', () => {
    test('should display back button when the parent is channel info', () => {
        renderWithContext(
            <SearchResultsHeader
                previousRhsState={RHSStates.CHANNEL_INFO as RhsState}
                canGoBack={true}
                isExpanded={false}
                channelId='channel_id'
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </SearchResultsHeader>,
        );

        expect(screen.getByLabelText('Back Icon')).toBeInTheDocument();
    });
    test('should NOT diplay expand when the parent is channel info', () => {
        renderWithContext(
            <SearchResultsHeader
                previousRhsState={RHSStates.CHANNEL_INFO as RhsState}
                canGoBack={true}
                isExpanded={false}
                channelId='channel_id'
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </SearchResultsHeader>,
        );

        expect(screen.queryByLabelText('Expand Sidebar Icon')).not.toBeInTheDocument();
    });
    test('should diplay expand when the parent is NOT channel info', () => {
        renderWithContext(
            <SearchResultsHeader
                previousRhsState={RHSStates.FLAG as RhsState}
                canGoBack={true}
                isExpanded={false}
                channelId='channel_id'
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </SearchResultsHeader>,
        );

        expect(screen.getByLabelText('Expand Sidebar Icon')).toBeInTheDocument();
    });
});
