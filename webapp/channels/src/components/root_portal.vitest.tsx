// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import RootPortal from './root_portal';

describe('components/RootPortal', () => {
    test('should match snapshot', () => {
        const rootPortalDiv = document.createElement('div');
        rootPortalDiv.id = 'root-portal';

        const {getByText, container} = renderWithIntl(
            <RootPortal>
                <div>{'Testing Portal'}</div>
            </RootPortal>,
            {container: document.body.appendChild(rootPortalDiv)},
        );

        expect(getByText('Testing Portal')).toBeVisible();
        expect(container).toMatchSnapshot();
    });
});
