// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {reArg} from './func';

describe('utils/func', () => {
    const a = 1;
    const b = 2;
    const c = 3;
    const component = 'Component';
    const node = 'Node';
    const children = 'Children';

    describe('reArg', () => {
        type TArgs = {a: 1; b: 2; c: 3; component: string; node: string; children: string};
        const method = reArg(['a', 'b', 'c', 'component', 'node', 'children'], (props: TArgs) => props);

        const normalizedArgs = {a, b, c, component, node, children};

        test('should support traditional ordered-arguments', () => {
            const result = method(a, b, c, component, node, children);
            expect(result).toMatchObject(normalizedArgs);
        });

        test('should support object-argument', () => {
            const result = method({a, b, c, component, node, children});
            expect(result).toMatchObject(normalizedArgs);
        });
    });
});
