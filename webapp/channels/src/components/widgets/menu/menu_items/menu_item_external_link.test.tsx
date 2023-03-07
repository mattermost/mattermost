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
      <a
        href="http://test.com"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span
          className="MenuItem__primary-text"
        >
          Whatever
        </span>
      </a>
    `);
    });
});
