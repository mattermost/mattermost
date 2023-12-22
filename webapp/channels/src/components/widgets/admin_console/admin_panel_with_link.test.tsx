// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AdminPanelWithLink from './admin_panel_with_link';

describe('components/widgets/admin_console/AdminPanelWithLink', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        titleId: 'test-title-id',
        titleDefault: 'test-title-default',
        subtitleId: 'test-subtitle-id',
        subtitleDefault: 'test-subtitle-default',
        url: '/path',
        linkTextId: 'test-button-text-id',
        linkTextDefault: 'test-button-text-default',
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
              subtitleDefault="test-subtitle-default"
              subtitleId="test-subtitle-id"
              titleDefault="test-title-default"
              titleId="test-title-id"
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
              subtitleDefault="test-subtitle-default"
              subtitleId="test-subtitle-id"
              titleDefault="test-title-default"
              titleId="test-title-id"
            >
              Test
            </AdminPanel>
        `);
    });
});
