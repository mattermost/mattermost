// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {isPopoutWindow} from 'utils/popouts/popout_windows';

import type {RhsState} from 'types/store/rhs';

import SearchResultsHeader from './search_results_header';

jest.mock('utils/popouts/popout_windows', () => ({
    isPopoutWindow: jest.fn(),
}));

jest.mock('components/popout_button', () => ({
    __esModule: true,
    default: ({onClick}: {onClick: () => void}) => (
        <button
            data-testid='popout-button'
            onClick={onClick}
            aria-label='Open in new window'
        >
            {'Popout Button'}
        </button>
    ),
}));

const mockIsPopoutWindow = isPopoutWindow as jest.MockedFunction<typeof isPopoutWindow>;

describe('search_results_header', () => {
    beforeEach(() => {
        mockIsPopoutWindow.mockReturnValue(false);
    });

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

    test('should render popout button when newWindowHandler exists', () => {
        const newWindowHandler = jest.fn();

        renderWithContext(
            <SearchResultsHeader
                previousRhsState={RHSStates.FLAG as RhsState}
                canGoBack={true}
                isExpanded={false}
                channelId='channel_id'
                newWindowHandler={newWindowHandler}
                actions={{
                    closeRightHandSide: jest.fn(),
                    toggleRhsExpanded: jest.fn(),
                    goBack: jest.fn(),
                }}
            >
                {'Title'}
            </SearchResultsHeader>,
        );

        expect(screen.getByTestId('popout-button')).toBeInTheDocument();
        expect(screen.getByLabelText('Open in new window')).toBeInTheDocument();
    });

    test('should hide expand and close buttons when in popout window', () => {
        mockIsPopoutWindow.mockReturnValue(true);

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

        expect(screen.queryByLabelText('Expand Sidebar Icon')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Close Sidebar Icon')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    });
});
