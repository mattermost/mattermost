// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BackstageHeader from 'components/backstage/components/backstage_header';

import {render} from 'tests/react_testing_utils';

describe('components/backstage/components/BackstageHeader', () => {
    test('should match snapshot without children', () => {
        const {container} = render(
            <BackstageHeader/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const {container} = render(
            <BackstageHeader>
                <div>{'Child 1'}</div>
                <div>{'Child 2'}</div>
            </BackstageHeader>,
        );
        expect(container).toMatchSnapshot();
    });
});
