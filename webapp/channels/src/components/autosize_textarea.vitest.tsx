// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect} from 'vitest';

import AutosizeTextarea from 'components/autosize_textarea';

describe('components/AutosizeTextarea', () => {
    test('should match snapshot, init', () => {
        const {container} = render(
            <AutosizeTextarea/>,
        );

        expect(container).toMatchSnapshot();
    });
});
