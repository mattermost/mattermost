// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {MenuItemBlockableLinkImpl} from './menu_item_blockable_link';

describe('components/MenuItemBlockableLink', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuItemBlockableLinkImpl
                to='/wherever'
                text='Whatever'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
<Connect(BlockableLink)
  to="/wherever"
>
  Whatever
</Connect(BlockableLink)>
`);
    });
});
