// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi, beforeEach} from 'vitest';

import RootPortal from './root_portal';

describe('components/RootPortal', () => {
    beforeEach(() => {
        // Quick fix to disregard console error when unmounting a component
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('should match snapshot', () => {
        const rootPortalDiv = document.createElement('div');
        rootPortalDiv.id = 'root-portal';

        const {getByText, container} = render(
            <RootPortal>
                <div>{'Testing Portal'}</div>
            </RootPortal>,
            {container: document.body.appendChild(rootPortalDiv)},
        );

        expect(getByText('Testing Portal')).toBeVisible();
        expect(container).toMatchSnapshot();
    });
});
