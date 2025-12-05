// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/vitest_react_testing_utils';

import Popover from '.';

describe('components/widgets/popover', () => {
    test('plain', () => {
        const {container} = render(
            <Popover id='test'>
                {'Some text'}
            </Popover>,
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
