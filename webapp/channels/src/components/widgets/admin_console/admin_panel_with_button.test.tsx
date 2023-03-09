// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AdminPanelWithButton from './admin_panel_with_button';

describe('components/widgets/admin_console/AdminPanelWithButton', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        titleId: 'test-title-id',
        titleDefault: 'test-title-default',
        subtitleId: 'test-subtitle-id',
        subtitleDefault: 'test-subtitle-default',
        onButtonClick: jest.fn(),
        buttonTextId: 'test-button-text-id',
        buttonTextDefault: 'test-button-text-default',
        disabled: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AdminPanelWithButton {...defaultProps}>
                {'Test'}
            </AdminPanelWithButton>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={
                <a
                  className="btn btn-primary"
                  data-testid="test-button-text-default"
                  onClick={[MockFunction]}
                >
                  <Memo(MemoizedFormattedMessage)
                    defaultMessage="test-button-text-default"
                    id="test-button-text-id"
                  />
                </a>
              }
              className="AdminPanelWithButton test-class-name"
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
            <AdminPanelWithButton
                {...defaultProps}
                disabled={true}
            >
                {'Test'}
            </AdminPanelWithButton>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <AdminPanel
              button={
                <a
                  className="btn btn-primary disabled"
                  data-testid="test-button-text-default"
                  onClick={[Function]}
                >
                  <Memo(MemoizedFormattedMessage)
                    defaultMessage="test-button-text-default"
                    id="test-button-text-id"
                  />
                </a>
              }
              className="AdminPanelWithButton test-class-name"
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
