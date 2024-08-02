// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {MenuItemLinkImpl} from './menu_item_link';

describe('components/MenuItemLink', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuItemLinkImpl
                to='/wherever'
                text='Whatever'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
            <Fragment>
              <Link
                className=""
                to="/wherever"
              >
                <span
                  className="MenuItem__primary-text"
                >
                  Whatever
                </span>
              </Link>
            </Fragment>
        `);
    });
});
