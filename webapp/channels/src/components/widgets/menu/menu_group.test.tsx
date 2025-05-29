// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import MenuGroup from './menu_group';

describe('components/MenuItem', () => {
    test('should match snapshot with default divider', () => {
        const wrapper = shallow(<MenuGroup>{'text'}</MenuGroup>);

        expect(wrapper).toMatchInlineSnapshot(`
<Fragment>
  <li
    className="MenuGroup menu-divider"
    onClick={[Function]}
    role="separator"
  />
  text
</Fragment>
`);
    });

    test('should match snapshot with custom divider', () => {
        const wrapper = shallow(<MenuGroup divider='--'>{'text'}</MenuGroup>);

        expect(wrapper).toMatchInlineSnapshot(`
<Fragment>
  --
  text
</Fragment>
`);
    });
});
