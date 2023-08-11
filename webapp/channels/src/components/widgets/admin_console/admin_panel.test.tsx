// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import AdminPanel from './admin_panel';

describe('components/widgets/admin_console/AdminPanel', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        titleId: 'test-title-id',
        titleDefault: 'test-title-default',
        subtitleId: 'test-subtitle-id',
        subtitleDefault: 'test-subtitle-default',
        subtitleValues: {foo: 'bar'},
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AdminPanel {...defaultProps}>{'Test'}</AdminPanel>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="AdminPanel clearfix test-class-name"
              id="test-id"
            >
              <div
                className="header"
              >
                <div>
                  <h3>
                    <MemoizedFormattedMessage
                      defaultMessage="test-title-default"
                      id="test-title-id"
                    />
                  </h3>
                  <div
                    className="mt-2"
                  >
                    <MemoizedFormattedMessage
                      defaultMessage="test-subtitle-default"
                      id="test-subtitle-id"
                      values={
                        Object {
                          "foo": "bar",
                        }
                      }
                    />
                  </div>
                </div>
              </div>
              Test
            </div>
        `);
    });

    test('should match snapshot with button', () => {
        const wrapper = shallow(
            <AdminPanel
                {...defaultProps}
                button={<span>{'TestButton'}</span>}
            >
                {'Test'}
            </AdminPanel>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="AdminPanel clearfix test-class-name"
              id="test-id"
            >
              <div
                className="header"
              >
                <div>
                  <h3>
                    <MemoizedFormattedMessage
                      defaultMessage="test-title-default"
                      id="test-title-id"
                    />
                  </h3>
                  <div
                    className="mt-2"
                  >
                    <MemoizedFormattedMessage
                      defaultMessage="test-subtitle-default"
                      id="test-subtitle-id"
                      values={
                        Object {
                          "foo": "bar",
                        }
                      }
                    />
                  </div>
                </div>
                <div
                  className="button"
                >
                  <span>
                    TestButton
                  </span>
                </div>
              </div>
              Test
            </div>
        `);
    });

    test('should match snapshot with onHeaderClick', () => {
        const wrapper = shallow(
            <AdminPanel
                {...defaultProps}
                onHeaderClick={jest.fn()}
            >
                {'Test'}
            </AdminPanel>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="AdminPanel clearfix test-class-name"
              id="test-id"
            >
              <div
                className="header"
                onClick={[MockFunction]}
              >
                <div>
                  <h3>
                    <MemoizedFormattedMessage
                      defaultMessage="test-title-default"
                      id="test-title-id"
                    />
                  </h3>
                  <div
                    className="mt-2"
                  >
                    <MemoizedFormattedMessage
                      defaultMessage="test-subtitle-default"
                      id="test-subtitle-id"
                      values={
                        Object {
                          "foo": "bar",
                        }
                      }
                    />
                  </div>
                </div>
              </div>
              Test
            </div>
        `);
    });
});
