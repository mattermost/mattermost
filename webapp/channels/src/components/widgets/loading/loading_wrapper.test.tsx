// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import LoadingWrapper from './loading_wrapper';

describe('components/widgets/loading/LoadingWrapper', () => {
    const testCases = [
        {
            name: 'showing spinner with text',
            loading: true,
            text: 'test',
            children: 'children',
        },
        {
            name: 'showing spinner without text',
            loading: true,
            children: 'text',
        },
        {
            name: 'showing content with children',
            loading: false,
            children: 'text',
        },
        {
            name: 'showing content without children',
            loading: false,
        },
    ];
    for (const testCase of testCases) {
        test(testCase.name, () => {
            const wrapper = mountWithIntl(
                <LoadingWrapper
                    loading={testCase.loading}
                    text={testCase.text}
                >
                    {testCase.children}
                </LoadingWrapper>,
            );
            expect(wrapper).toMatchSnapshot();
        });
    }
});
