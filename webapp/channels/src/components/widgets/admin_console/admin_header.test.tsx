// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint no-console: 0 */

import React from 'react';
import {shallow} from 'enzyme';

import AdminHeader from './admin_header';

describe('components/widgets/admin_console/AdminHeader', () => {
    test('render component with child', () => {
        const wrapper = shallow(<AdminHeader>{'Test'}</AdminHeader>);
        expect(wrapper).toMatchInlineSnapshot(`
<div
  className="admin-console__header"
>
  Test
</div>
`,
        );
    });
});
