// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AdminPanelTogglable from './admin_panel_togglable';

describe('components/widgets/admin_console/AdminPanelTogglable', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        open: true,
        onToggle: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={<AccordionToggleIcon />}
              className="AdminPanelTogglable test-class-name"
              id="test-id"
              onHeaderClick={[MockFunction]}
              subtitle={
                Object {
                  "defaultMessage": "test-subtitle-default",
                  "id": "test-subtitle-id",
                }
              }
              title={
                Object {
                  "defaultMessage": "test-title-default",
                  "id": "test-title-id",
                }
              }
            >
              Test
            </AdminPanel>
        `);
    });

    test('should match snapshot closed', () => {
        const wrapper = shallow(
            <AdminPanelTogglable
                {...defaultProps}
                open={false}
            >
                {'Test'}
            </AdminPanelTogglable>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={<AccordionToggleIcon />}
              className="AdminPanelTogglable test-class-name closed"
              id="test-id"
              onHeaderClick={[MockFunction]}
              subtitle={
                Object {
                  "defaultMessage": "test-subtitle-default",
                  "id": "test-subtitle-id",
                }
              }
              title={
                Object {
                  "defaultMessage": "test-title-default",
                  "id": "test-title-id",
                }
              }
            >
              Test
            </AdminPanel>
        `);
    });
});
