// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {MenuItemActionImpl} from './menu_item_action';

describe('components/MenuItemAction', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuItemActionImpl
                onClick={jest.fn()}
                text='Whatever'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
            <Fragment>
              <button
                className="style--none"
                onClick={[MockFunction]}
              >
                <span
                  className="MenuItem__primary-text"
                >
                  Whatever
                </span>
              </button>
            </Fragment>
        `);
    });
    test('should match snapshot with extra text', () => {
        const wrapper = shallow(
            <MenuItemActionImpl
                onClick={jest.fn()}
                text='Whatever'
                extraText='Extra Text'
            />,
        );

        expect(wrapper).toMatchInlineSnapshot(`
            <Fragment>
              <button
                className="style--none MenuItem__with-help"
                onClick={[MockFunction]}
              >
                <span
                  className="MenuItem__primary-text"
                >
                  Whatever
                </span>
                <span
                  className="MenuItem__help-text"
                >
                  Extra Text
                </span>
              </button>
            </Fragment>
        `);
    });
});
