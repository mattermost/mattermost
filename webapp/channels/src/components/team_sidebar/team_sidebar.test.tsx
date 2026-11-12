// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {getTeamSwitchURL, TeamSidebar} from './team_sidebar';
import type {Props} from './team_sidebar';

describe('getTeamSwitchURL', () => {
    it('returns the team-scoped product URL when in a team-scoped product', () => {
        const product = {...TestHelper.makeProduct('spaces'), baseURL: '/spaces', isTeamScoped: true};

        expect(getTeamSwitchURL(product, 'myteam')).toBe('/myteam/spaces');
    });

    it('returns the plain team URL when in a global product', () => {
        const product = {...TestHelper.makeProduct('boards'), baseURL: '/boards', isTeamScoped: false};

        expect(getTeamSwitchURL(product, 'myteam')).toBe('/myteam');
    });

    it('returns the plain team URL when not in a product', () => {
        expect(getTeamSwitchURL(null, 'myteam')).toBe('/myteam');
    });
});

describe('TeamSidebar', () => {
    const teams = [
        TestHelper.getTeamMock({id: 'team-one', name: 'team-one', display_name: 'Team One'}),
        TestHelper.getTeamMock({id: 'team-two', name: 'team-two', display_name: 'Team Two'}),
    ];
    const agents = {...TestHelper.makeProduct('agents'), baseURL: '/plug/agents', showTeamSidebar: false};

    // The sidebar marks #root when there are teams to switch between.
    beforeEach(() => {
        const root = document.createElement('div');
        root.id = 'root';
        document.body.appendChild(root);
    });

    afterEach(() => {
        document.getElementById('root')?.remove();
    });

    function renderAt(pathname: string, props: Partial<Props> = {}) {
        const allProps: Props = {
            currentTeamId: 'team-one',
            myTeams: teams,
            isOpen: false,
            experimentalPrimaryTeam: undefined,
            locale: 'en',
            moreTeamsToJoin: false,
            userTeamsOrderPreference: '',
            products: [agents],
            unreadTeamsSet: new Set(),
            mentionsInTeamMap: new Map(),
            teamHasUrgentMap: new Map(),
            isProductRailShown: true,
            isHiddenByProductRail: false,
            actions: {
                getTeams: jest.fn(),
                switchTeam: jest.fn(),
                updateTeamsOrderForUser: jest.fn(),
                setTeamSidebarHidden: jest.fn(),
            },
            intl: defaultIntl,
            location: {pathname, search: '', hash: '', state: undefined},
            ...props,
        } as unknown as Props;

        return renderWithContext(<TeamSidebar {...allProps}/>, {entities: {teams: {currentTeamId: 'team-one'}}});
    }

    test('should stay in a global product while the product rail is shown', () => {
        const {container} = renderAt('/plug/agents');

        expect(container.querySelector('.team-sidebar')).toBeInTheDocument();
    });

    test('should leave a global product that hides it alone without the rail', () => {
        const {container} = renderAt('/plug/agents', {isProductRailShown: false});

        expect(container.querySelector('.team-sidebar')).not.toBeInTheDocument();
    });

    test('should offer to hide it, for the rail team menu to stand in', () => {
        renderAt('/team-one/channels/town-square');

        expect(screen.getByRole('button', {name: 'Hide team sidebar'})).toBeInTheDocument();
    });

    test('should stay hidden where the rail team menu stands in for it', () => {
        const {container} = renderAt('/team-one/channels/town-square', {isHiddenByProductRail: true});

        expect(container.querySelector('.team-sidebar')).not.toBeInTheDocument();
    });

    test('should come back on backstage pages, which leave the rail out, without the hide button', () => {
        const {container} = renderAt('/team-one/integrations', {isHiddenByProductRail: true});

        expect(container.querySelector('.team-sidebar')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Hide team sidebar'})).not.toBeInTheDocument();
    });
});
