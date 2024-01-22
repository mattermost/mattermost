// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AdminPanelWithLink from './admin_panel_with_link';

describe('components/widgets/admin_console/AdminPanelWithLink', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        url: '/path',
        linkText: {
            id: 'test-button-text-id',
            defaultMessage: 'test-button-text-default',
        },
        disabled: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AdminPanelWithLink {...defaultProps}>{'Test'}</AdminPanelWithLink>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={
                <Link
                  className="btn btn-primary"
                  data-testid="test-id-link"
                  onClick={[Function]}
                  to="/path"
                >
                  <Memo(MemoizedFormattedMessage)
                    defaultMessage="test-button-text-default"
                    id="test-button-text-id"
                  />
                </Link>
              }
              className="AdminPanelWithLink test-class-name"
              data-testid="test-id"
              id="test-id"
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

    test('should match snapshot when disabled', () => {
        const wrapper = shallow(
            <AdminPanelWithLink
                {...defaultProps}
                disabled={true}
            >
                {'Test'}
            </AdminPanelWithLink>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={
                <Link
                  className="btn btn-primary disabled"
                  data-testid="test-id-link"
                  onClick={[Function]}
                  to="/path"
                >
                  <Memo(MemoizedFormattedMessage)
                    defaultMessage="test-button-text-default"
                    id="test-button-text-id"
                  />
                </Link>
              }
              className="AdminPanelWithLink test-class-name"
              data-testid="test-id"
              id="test-id"
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
