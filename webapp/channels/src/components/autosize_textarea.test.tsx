// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AutosizeTextarea from 'components/autosize_textarea';

import {render} from 'tests/react_testing_utils';

describe('components/AutosizeTextarea', () => {
    test('should match snapshot, init', () => {
        const {container} = render(
            <AutosizeTextarea/>,
        );

        expect(container).toMatchSnapshot();
    });
});
