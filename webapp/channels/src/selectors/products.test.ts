// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';

import {selectTeamScopedProducts} from './products';

const teamScoped = {...TestHelper.makeProduct('spaces'), isTeamScoped: true};
const global = {...TestHelper.makeProduct('boards'), isTeamScoped: false};

function stateWith(products: ProductComponent[]): GlobalState {
    return {plugins: {components: {Product: products}}} as unknown as GlobalState;
}

describe('selectTeamScopedProducts', () => {
    it('returns only team-scoped products', () => {
        expect(selectTeamScopedProducts(stateWith([teamScoped, global]))).toEqual([teamScoped]);
    });

    it('returns a stable reference when the product list is unchanged (memoized)', () => {
        const state = stateWith([teamScoped, global]);

        expect(selectTeamScopedProducts(state)).toBe(selectTeamScopedProducts(state));
    });

    it('recomputes when the product list changes', () => {
        const first = selectTeamScopedProducts(stateWith([teamScoped, global]));
        const second = selectTeamScopedProducts(stateWith([global]));

        expect(first).not.toBe(second);
        expect(second).toEqual([]);
    });
});
