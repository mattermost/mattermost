// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AdminPanelWithButton from './admin_panel_with_button';

describe('components/widgets/admin_console/AdminPanelWithButton', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        onButtonClick: jest.fn(),
        buttonText: {
            id: 'test-button-text-id',
            defaultMessage: 'test-button-text-default',
        },
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
