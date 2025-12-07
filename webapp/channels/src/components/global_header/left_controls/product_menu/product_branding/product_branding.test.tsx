// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TopLevelProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ProductBranding from './product_branding';

jest.mock('utils/products', () => ({
    useCurrentProduct: jest.fn(),
}));

describe('components/ProductBranding', () => {
    test('should show correct icon glyph when we are on Channels', () => {
        const {useCurrentProduct} = require('utils/products');
        useCurrentProduct.mockReturnValue(null);

        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Playbooks', () => {
        const {useCurrentProduct} = require('utils/products');
        useCurrentProduct.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS));
        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Boards', () => {
        const {useCurrentProduct} = require('utils/products');
        useCurrentProduct.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.BOARDS));

        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
