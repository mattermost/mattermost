// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {sortPoliciesByOrder} from './settings';

describe('sortPoliciesByOrder', () => {
    test('orders listed policies by their position', () => {
        const policies = [{id: 'c'}, {id: 'a'}, {id: 'b'}];

        expect(sortPoliciesByOrder(policies, ['a', 'b', 'c']).map((p) => p.id)).toEqual(['a', 'b', 'c']);
        expect(policies.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    });

    test('places policies missing from the order first, keeping their order', () => {
        const policies = [{id: 'listed_second'}, {id: 'new_one'}, {id: 'listed_first'}, {id: 'new_two'}];

        expect(sortPoliciesByOrder(policies, ['listed_first', 'stale', 'listed_second']).map((p) => p.id)).toEqual([
            'new_one',
            'new_two',
            'listed_first',
            'listed_second',
        ]);
    });
});
