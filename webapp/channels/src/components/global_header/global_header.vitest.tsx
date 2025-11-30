// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GlobalHeader from 'components/global_header/global_header';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import * as productUtils from 'utils/products';

import * as hooks from './hooks';

describe('components/global/global_header', () => {
    test('should be disabled when global header is disabled', () => {
        const spyProduct = vi.spyOn(productUtils, 'useCurrentProductId');
        spyProduct.mockReturnValue(null);

        const spyLoggedIn = vi.spyOn(hooks, 'useIsLoggedIn');
        spyLoggedIn.mockReturnValue(false);

        const {container} = renderWithContext(
            <GlobalHeader/>,
        );

        // Global header should render null (empty container)
        expect(container.firstChild).toBeNull();
    });

    test('should be enabled when global header is enabled', () => {
        const spyProduct = vi.spyOn(productUtils, 'useCurrentProductId');
        spyProduct.mockReturnValue(null);

        const spyLoggedIn = vi.spyOn(hooks, 'useIsLoggedIn');
        spyLoggedIn.mockReturnValue(true);

        const {container} = renderWithContext(
            <GlobalHeader/>,
        );

        // Global header should not be null
        expect(container.firstChild).not.toBeNull();
    });
});
