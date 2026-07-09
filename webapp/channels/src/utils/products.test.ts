// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ProductComponent} from 'types/store/plugins';

import {
    isTeamScopedProductBaseURL,
    getTeamScopedProductRoutePath,
    getProductRoutePath,
    getTeamScopedProductURL,
    getProductSwitcherLinkURL,
} from './products';

function makeProduct(overrides: Partial<ProductComponent>): ProductComponent {
    return {
        baseURL: '/boards',
        switcherLinkURL: '/boards',
        ...overrides,
    } as ProductComponent;
}

describe('isTeamScopedProductBaseURL', () => {
    it('returns true when the baseURL begins with the team-scoped prefix', () => {
        expect(isTeamScopedProductBaseURL('/:team/spaces')).toBe(true);
    });

    it('returns false for a global product baseURL', () => {
        expect(isTeamScopedProductBaseURL('/boards')).toBe(false);
    });

    it('returns false when the team token appears but not as the leading segment', () => {
        expect(isTeamScopedProductBaseURL('/spaces/:team/')).toBe(false);
    });

    it('returns false for an empty baseURL', () => {
        expect(isTeamScopedProductBaseURL('')).toBe(false);
    });
});

describe('getTeamScopedProductRoutePath', () => {
    it('replaces the team-scoped prefix with a team-name-matching route param', () => {
        expect(getTeamScopedProductRoutePath('/:team/spaces')).toBe('/:team([a-z0-9\\-_]+)/spaces');
    });

    it('preserves a multi-segment keyword after the team prefix', () => {
        expect(getTeamScopedProductRoutePath('/:team/spaces/settings')).toBe('/:team([a-z0-9\\-_]+)/spaces/settings');
    });
});

describe('getProductRoutePath', () => {
    it('converts a team-scoped baseURL into a parameterized route path', () => {
        expect(getProductRoutePath('/:team/spaces')).toBe('/:team([a-z0-9\\-_]+)/spaces');
    });

    it('returns a global baseURL unchanged', () => {
        expect(getProductRoutePath('/boards')).toBe('/boards');
    });
});

describe('getTeamScopedProductURL', () => {
    it('replaces the team-scoped prefix with the concrete team name', () => {
        expect(getTeamScopedProductURL('/:team/spaces', 'myteam')).toBe('/myteam/spaces');
    });

    it('substitutes a team name containing hyphens and underscores', () => {
        expect(getTeamScopedProductURL('/:team/spaces', 'other-team_2')).toBe('/other-team_2/spaces');
    });
});

describe('getProductSwitcherLinkURL', () => {
    it('prefixes the switcher link with the current team for a team-scoped product', () => {
        const product = makeProduct({baseURL: '/:team/spaces', switcherLinkURL: '/spaces'});

        expect(getProductSwitcherLinkURL(product, 'myteam')).toBe('/myteam/spaces');
    });

    it('returns the switcher link unchanged for a team-scoped product when no current team is provided', () => {
        const product = makeProduct({baseURL: '/:team/spaces', switcherLinkURL: '/spaces'});

        expect(getProductSwitcherLinkURL(product, undefined)).toBe('/spaces');
    });

    it('returns the switcher link unchanged for a team-scoped product when the current team name is empty', () => {
        const product = makeProduct({baseURL: '/:team/spaces', switcherLinkURL: '/spaces'});

        expect(getProductSwitcherLinkURL(product, '')).toBe('/spaces');
    });

    it('returns the switcher link unchanged for a global product even when a current team is provided', () => {
        const product = makeProduct({baseURL: '/boards', switcherLinkURL: '/boards'});

        expect(getProductSwitcherLinkURL(product, 'myteam')).toBe('/boards');
    });
});
