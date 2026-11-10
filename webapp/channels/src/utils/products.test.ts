// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ProductComponent} from 'types/store/plugins';

import {
    isTeamScopedProduct,
    getTeamScopedProductRoutePath,
    getTeamScopedProductURL,
    getProductSwitcherLinkURL,
    getCurrentProduct,
} from './products';

function makeProduct(overrides: Partial<ProductComponent>): ProductComponent {
    return {
        id: 'product-id',
        baseURL: '/boards',
        switcherLinkURL: '/boards',
        isTeamScoped: false,
        ...overrides,
    } as ProductComponent;
}

describe('isTeamScopedProduct', () => {
    it('returns true when the product is flagged team-scoped', () => {
        expect(isTeamScopedProduct(makeProduct({isTeamScoped: true}))).toBe(true);
    });

    it('returns false when the product is not team-scoped', () => {
        expect(isTeamScopedProduct(makeProduct({isTeamScoped: false}))).toBe(false);
    });

    it('returns false when the team-scoped flag is absent', () => {
        expect(isTeamScopedProduct(makeProduct({isTeamScoped: undefined}))).toBe(false);
    });
});

describe('getTeamScopedProductRoutePath', () => {
    it('prefixes a team-name route param onto the baseURL', () => {
        expect(getTeamScopedProductRoutePath('/spaces')).toBe('/:team([a-z0-9\\-_]+)/spaces');
    });

    it('preserves a multi-segment baseURL', () => {
        expect(getTeamScopedProductRoutePath('/spaces/settings')).toBe('/:team([a-z0-9\\-_]+)/spaces/settings');
    });
});

describe('getTeamScopedProductURL', () => {
    it('prefixes the concrete team name onto the baseURL', () => {
        expect(getTeamScopedProductURL('/spaces', 'myteam')).toBe('/myteam/spaces');
    });

    it('handles team names containing hyphens and underscores', () => {
        expect(getTeamScopedProductURL('/spaces', 'other-team_2')).toBe('/other-team_2/spaces');
    });
});

describe('getProductSwitcherLinkURL', () => {
    it('prefixes the switcher link with the current team for a team-scoped product', () => {
        const product = makeProduct({switcherLinkURL: '/spaces', isTeamScoped: true});

        expect(getProductSwitcherLinkURL(product, 'myteam')).toBe('/myteam/spaces');
    });

    it('returns null for a team-scoped product when no current team is provided', () => {
        const product = makeProduct({switcherLinkURL: '/spaces', isTeamScoped: true});

        expect(getProductSwitcherLinkURL(product, undefined)).toBeNull();
    });

    it('returns null for a team-scoped product when the current team name is empty', () => {
        const product = makeProduct({switcherLinkURL: '/spaces', isTeamScoped: true});

        expect(getProductSwitcherLinkURL(product, '')).toBeNull();
    });

    it('returns the switcher link unchanged for a global product even when a current team is provided', () => {
        const product = makeProduct({switcherLinkURL: '/boards', isTeamScoped: false});

        expect(getProductSwitcherLinkURL(product, 'myteam')).toBe('/boards');
    });
});

describe('getCurrentProduct', () => {
    const teamScoped = makeProduct({id: 'docs', baseURL: '/spaces', isTeamScoped: true});
    const global = makeProduct({id: 'boards', baseURL: '/boards', isTeamScoped: false});
    const products = [teamScoped, global];

    it('matches a team-scoped product against a team-prefixed pathname', () => {
        expect(getCurrentProduct(products, '/myteam/spaces')).toBe(teamScoped);
    });

    it('matches a global product against its baseURL', () => {
        expect(getCurrentProduct(products, '/boards/some-board')).toBe(global);
    });

    it('does not match a team-scoped product when the keyword segment is absent', () => {
        expect(getCurrentProduct(products, '/myteam/channels/town-square')).toBeNull();
    });

    it('returns null when no product matches the pathname', () => {
        expect(getCurrentProduct(products, '/nomatch')).toBeNull();
    });
});
