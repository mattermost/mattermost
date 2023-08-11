// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import AdminPanelTogglable from './admin_panel_togglable';

describe('components/widgets/admin_console/AdminPanelTogglable', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        titleId: 'test-title-id',
        titleDefault: 'test-title-default',
        subtitleId: 'test-subtitle-id',
        subtitleDefault: 'test-subtitle-default',
        open: true,
        onToggle: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AdminPanelTogglable {...defaultProps}>{'Test'}</AdminPanelTogglable>);
        expect(wrapper).toMatchInlineSnapshot(`
<AdminPanel
  button={<AccordionToggleIcon />}
  className="AdminPanelTogglable test-class-name"
  id="test-id"
  onHeaderClick={[MockFunction]}
  subtitleDefault="test-subtitle-default"
  subtitleId="test-subtitle-id"
  titleDefault="test-title-default"
  titleId="test-title-id"
>
  Test
</AdminPanel>
`,
        );
    });

    test('should match snapshot closed', () => {
        const wrapper = shallow(
            <AdminPanelTogglable
                {...defaultProps}
                open={false}
            >
                {'Test'}
            </AdminPanelTogglable>);
        expect(wrapper).toMatchInlineSnapshot(`
<AdminPanel
  button={<AccordionToggleIcon />}
  className="AdminPanelTogglable test-class-name closed"
  id="test-id"
  onHeaderClick={[MockFunction]}
  subtitleDefault="test-subtitle-default"
  subtitleId="test-subtitle-id"
  titleDefault="test-title-default"
  titleId="test-title-id"
>
  Test
</AdminPanel>
`,
        );
    });
});
