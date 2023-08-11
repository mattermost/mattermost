// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import LoadingWrapper from './loading_wrapper';

describe('components/widgets/loading/LoadingWrapper', () => {
    const testCases = [
        {
            name: 'showing spinner with text',
            loading: true,
            text: 'test',
            children: 'children',
            snapshot: `
<LoadingSpinner
  text="test"
/>
`,
        },
        {
            name: 'showing spinner without text',
            loading: true,
            children: 'text',
            snapshot: `
<LoadingSpinner
  text={null}
/>
`,
        },
        {
            name: 'showing content with children',
            loading: false,
            children: 'text',
            snapshot: '"text"',
        },
        {
            name: 'showing content without children',
            loading: false,
            snapshot: '""',
        },
    ];
    for (const testCase of testCases) {
        test(testCase.name, () => {
            const wrapper = shallow(
                <LoadingWrapper
                    loading={testCase.loading}
                    text={testCase.text}
                >
                    {testCase.children}
                </LoadingWrapper>,
            );
            expect(wrapper).toMatchInlineSnapshot(testCase.snapshot);
        });
    }
});
