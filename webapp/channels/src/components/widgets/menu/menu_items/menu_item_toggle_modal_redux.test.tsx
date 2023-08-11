// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {MenuItemToggleModalReduxImpl} from './menu_item_toggle_modal_redux';

describe('components/MenuItemToggleModalRedux', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={jest.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
            <Fragment>
              <Connect(ToggleModalButton)
                className=""
                dialogProps={
                  Object {
                    "test": "test",
                  }
                }
                dialogType={[MockFunction]}
                modalId="test"
              >
                <span
                  className="MenuItem__primary-text"
                >
                  Whatever
                </span>
              </Connect(ToggleModalButton)>
            </Fragment>
        `);
    });

    test('should match snapshot with extra text', () => {
        const wrapper = shallow(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={jest.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
                extraText='Extra text'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
