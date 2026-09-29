// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import {ProductHeading} from './product_heading';

describe('ProductHeading', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should name the current product as a heading', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        );

        renderWithContext(<ProductHeading/>);

        expect(screen.getByRole('heading', {name: TopLevelProducts.PLAYBOOKS})).toBeInTheDocument();
    });

    test('should fall back to Channels when there is no current product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(null);

        renderWithContext(<ProductHeading/>);

        expect(screen.getByRole('heading', {name: 'Channels'})).toBeInTheDocument();
    });
});
