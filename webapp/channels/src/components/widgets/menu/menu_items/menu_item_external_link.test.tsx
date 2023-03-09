// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {MenuItemExternalLinkImpl} from './menu_item_external_link';

describe('components/MenuItemExternalLink', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuItemExternalLinkImpl
                url='http://test.com'
                text='Whatever'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
            <ExternalLink
              href="http://test.com"
              location="menu_item_external_link"
            >
              <span
                className="MenuItem__primary-text"
              >
                Whatever
              </span>
            </ExternalLink>
        `);
    });
});
