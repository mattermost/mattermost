// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';

import './export';

// Production React does not provide jsxDEV. Keep the renderer in test mode so RTL works.
jest.mock('react/jsx-dev-runtime', () => ({
    ...jest.requireActual('react/jsx-dev-runtime'),
    jsxDEV: undefined,
}));

test('production JSX development fallback renders dynamic and static children with keys and refs', () => {
    const runtime = (window as any).ReactJSXDevRuntime;
    const ref = React.createRef<HTMLSpanElement>();
    const child = runtime.jsxDEV('span', {ref, children: 'Runtime child'}, 'child-key', false);
    const fragment = runtime.jsxDEV(runtime.Fragment, {children: [child]}, 'fragment-key', true);

    const {getByText} = render(fragment);

    expect(ref.current).toBe(getByText('Runtime child'));
    expect(child.key).toBe('child-key');
    expect(fragment.key).toBe('fragment-key');
});
