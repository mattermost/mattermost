// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RecapsLink from './recaps_link';

const mockUseFeatureFlag = jest.fn(() => 'true');
jest.mock('components/common/hooks/useGetFeatureFlagValue', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockUseFeatureFlag(...args as []),
}));

const mockGetBadge = jest.fn(() => ({count: 0, hasFailed: false}));
jest.mock('mattermost-redux/selectors/entities/recaps', () => ({
    getUnreadFinishedRecapsBadge: () => mockGetBadge(),
}));

const defaultState = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {team1: {id: 'team1', name: 'team1'}},
        },
        users: {
            currentUserId: 'user1',
            profiles: {user1: {id: 'user1'}},
        },
    },
};

function renderLink() {
    return renderWithContext(
        <MemoryRouter initialEntries={['/team1']}>
            <Route path='/:team'>
                <RecapsLink/>
            </Route>
        </MemoryRouter>,
        defaultState,
    );
}

describe('components/recaps_link/RecapsLink', () => {
    beforeEach(() => {
        mockUseFeatureFlag.mockReturnValue('true');
        mockGetBadge.mockReturnValue({count: 0, hasFailed: false});
    });

    test('renders nothing when the feature flag is disabled', () => {
        mockUseFeatureFlag.mockReturnValue('false');
        mockGetBadge.mockReturnValue({count: 5, hasFailed: true});
        const {container} = renderLink();
        expect(container).toBeEmptyDOMElement();
    });

    test('does not render a badge when there are no unread recaps', () => {
        const {container} = renderLink();
        expect(screen.getByText('Recaps')).toBeInTheDocument();
        expect(container.querySelector('.badge')).not.toBeInTheDocument();
        expect(container.querySelector('.RecapsFailedIcon')).not.toBeInTheDocument();
        expect(container.querySelector('.SidebarChannel')).not.toHaveClass('unread');
    });

    test('renders the count badge and marks the link unread when there are unread recaps', () => {
        mockGetBadge.mockReturnValue({count: 3, hasFailed: false});
        const {container} = renderLink();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(container.querySelector('.SidebarChannel')).toHaveClass('unread');
        expect(container.querySelector('.SidebarLink')).toHaveClass('unread-title');
        expect(container.querySelector('.RecapsFailedIcon')).not.toBeInTheDocument();
    });

    test('renders an alert icon instead of the count when a failed unread recap is present', () => {
        mockGetBadge.mockReturnValue({count: 2, hasFailed: true});
        const {container} = renderLink();
        expect(container.querySelector('.RecapsFailedIcon')).toBeInTheDocument();
        expect(container.querySelector('.badge')).not.toBeInTheDocument();
        expect(screen.queryByText('2')).not.toBeInTheDocument();
        expect(container.querySelector('.SidebarChannel')).toHaveClass('unread');
    });
});
