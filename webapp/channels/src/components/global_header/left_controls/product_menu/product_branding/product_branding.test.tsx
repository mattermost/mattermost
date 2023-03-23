// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import Icon from '@mattermost/compass-components/foundations/icon';

import {TopLevelProducts} from 'utils/constants';

import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import ProductBranding from './product_branding';

describe('components/ProductBranding', () => {
    test('should show correct icon glyph when we are on Channels', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(null);

        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper.find(Icon).prop('glyph')).toEqual('product-channels');
        expect(wrapper).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Playbooks', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS));
        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper.find(Icon).prop('glyph')).toEqual('product-playbooks');
        expect(wrapper).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Boards', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.BOARDS));

        const wrapper = shallow(
            <ProductBranding/>,
        );

        expect(wrapper.find(Icon).prop('glyph')).toEqual('product-boards');
        expect(wrapper).toMatchSnapshot();
    });
});
