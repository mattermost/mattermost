// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route, useLocation} from 'react-router-dom';

import {selectTeam} from 'mattermost-redux/actions/teams';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamScopedProductWrapper from './team_scoped_product_wrapper';

jest.mock('mattermost-redux/actions/teams', () => ({
    ...jest.requireActual('mattermost-redux/actions/teams'),
    selectTeam: jest.fn(() => ({type: 'MOCK_SELECT_TEAM'})),
}));

const mockedSelectTeam = selectTeam as jest.MockedFunction<typeof selectTeam>;

function LocationDisplay() {
    const location = useLocation();
    return <div data-testid='location'>{location.pathname + location.search}</div>;
}

function renderWrapper(currentTeamId: string, teams: Record<string, ReturnType<typeof TestHelper.getTeamMock>>) {
    return renderWithContext(
        <MemoryRouter initialEntries={['/myteam/spaces']}>
            <Route path='/:team/spaces'>
                <TeamScopedProductWrapper>
                    <div>{'Product'}</div>
                </TeamScopedProductWrapper>
            </Route>
            <LocationDisplay/>
        </MemoryRouter>,
        {
            entities: {
                teams: {
                    currentTeamId,
                    teams,
                },
            },
        },
    );
}

describe('TeamScopedProductWrapper', () => {
    const team = TestHelper.getTeamMock({id: 'team_id_1', name: 'myteam'});

    beforeEach(() => {
        mockedSelectTeam.mockClear();
    });

    it('renders the product when the URL team is already the current team', () => {
        renderWrapper('team_id_1', {team_id_1: team});

        expect(screen.getByText('Product')).toBeInTheDocument();
        expect(mockedSelectTeam).not.toHaveBeenCalled();
    });

    it('dispatches selectTeam and withholds the product when the URL team is not yet current', () => {
        renderWrapper('other_team_id', {team_id_1: team});

        expect(mockedSelectTeam).toHaveBeenCalledWith('team_id_1');
        expect(screen.queryByText('Product')).not.toBeInTheDocument();
    });

    it('renders the product once the dispatched team becomes current', () => {
        const {updateStoreState} = renderWrapper('other_team_id', {team_id_1: team});

        expect(screen.queryByText('Product')).not.toBeInTheDocument();

        updateStoreState({entities: {teams: {currentTeamId: 'team_id_1'}}});

        expect(screen.getByText('Product')).toBeInTheDocument();
    });

    it('redirects to the team-not-found error when the URL team cannot be resolved', () => {
        renderWrapper('team_id_1', {});

        expect(screen.getByTestId('location')).toHaveTextContent('/error?type=team_not_found');
        expect(screen.queryByText('Product')).not.toBeInTheDocument();
        expect(mockedSelectTeam).not.toHaveBeenCalled();
    });
});
