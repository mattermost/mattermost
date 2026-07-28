// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {getTeamSwitchURL} from './team_sidebar';

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
